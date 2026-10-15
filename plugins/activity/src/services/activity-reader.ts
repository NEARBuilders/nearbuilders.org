import type { z } from "every-plugin/zod";
import type {
  ActivityEventSchema,
  ActivityFiltersSchema,
  ActivityLeaderboardInputSchema,
} from "../contract";
import {
  type ActivityApiEvent,
  ActivityApiEventSchema,
  ActivityApiFeedSchema,
  ActivityApiLeaderboardSchema,
} from "./activity-api";
import { GATEWAY_EVENT_TYPES } from "./activity-gateway";

type ActivityEvent = z.infer<typeof ActivityEventSchema>;
type ActivityFilters = z.infer<typeof ActivityFiltersSchema>;
type LeaderboardPeriod = z.infer<typeof ActivityLeaderboardInputSchema>["period"];

/** The Activity source nearbuilders.org's own trusted events are published under, by default. */
export const NEARBUILDERS_SOURCE = "nearbuilders";

/** Activity's public read API. Reads need no key, so they default to production. */
export const DEFAULT_ACTIVITY_API_URL = "https://activity.nearbuilders.org/api";

const LEGACY_BY_EVENT_TYPE = new Map(
  Object.entries(GATEWAY_EVENT_TYPES).map(([legacy, eventType]) => {
    const [source = "", type = ""] = legacy.split(":");
    return [eventType, { source, type }] as const;
  }),
);

const LEADERBOARD_PERIODS = {
  week: "weekly",
  month: "monthly",
  "all-time": "all-time",
} as const satisfies Record<LeaderboardPeriod, string>;

/** Sources still under Activity review stay off nearbuilders.org until an administrator approves them. */
export function isPubliclyVisible(
  event: ActivityApiEvent,
  ownSource: string = NEARBUILDERS_SOURCE,
): boolean {
  return event.source === ownSource || event.provenance?.approvalStatus === "approved";
}

/**
 * Translates nearbuilders.org's filters into Activity's. Sources such as `projects` are Event Types
 * of nearbuilders.org's own source; a type that no forwarded event has matches nothing.
 */
export function toActivityQuery(
  filters: ActivityFilters,
  ownSource: string = NEARBUILDERS_SOURCE,
): { source?: string; type?: string; actor?: string } | null {
  const actor = filters.actor || undefined;
  if (!filters.source) return { type: filters.type, actor };
  const forwarded = Object.entries(GATEWAY_EVENT_TYPES).filter(([legacy]) =>
    legacy.startsWith(`${filters.source}:`),
  );
  if (forwarded.length === 0) return { source: filters.source, type: filters.type, actor };
  const match = filters.type
    ? forwarded.find(([legacy]) => legacy === `${filters.source}:${filters.type}`)
    : forwarded.length === 1
      ? forwarded[0]
      : undefined;
  if (filters.type && !match) return null;
  return { source: ownSource, type: match?.[1], actor };
}

/**
 * nearbuilders.org's own events keep their original source, type, and ID, so existing cards and
 * endorsements keep working. Other sources show only what Activity verifies: no payload claims.
 */
export function toActivityEvent(
  event: ActivityApiEvent,
  legacyIds: ReadonlyMap<string, string>,
  ownSource: string = NEARBUILDERS_SOURCE,
): ActivityEvent {
  const legacy = event.source === ownSource ? LEGACY_BY_EVENT_TYPE.get(event.type) : undefined;
  return {
    id: legacy ? (legacyIds.get(event.id) ?? event.id) : event.id,
    source: legacy?.source ?? event.source,
    type: legacy?.type ?? event.type,
    actor: event.actor,
    payload: legacy ? (event.payload ?? null) : null,
    verified: Boolean(legacy),
    hiddenAt: null,
    createdAt: event.timestamp,
  };
}

export function parseSseFrames(buffer: string): {
  frames: Array<{ id?: string; data: string }>;
  rest: string;
} {
  const parts = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = parts.pop() ?? "";
  const frames = parts.flatMap((part) => {
    let id: string | undefined;
    const data: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("id:")) id = line.slice(3).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    return data.length > 0 ? [{ id, data: data.join("\n") }] : [];
  });
  return { frames, rest };
}

function query(input: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export function createActivityReaderClient(options: {
  baseUrl: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function get(path: string): Promise<unknown> {
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Activity returned ${response.status}`);
    return response.json();
  }

  return {
    async listEvents(input: {
      source?: string;
      type?: string;
      actor?: string;
      limit: number;
      cursor?: string;
    }) {
      const body = ActivityApiFeedSchema.parse(await get(`/v1/events?${query(input)}`));
      return { data: body.data, nextCursor: body.meta.hasMore ? body.meta.nextCursor : null };
    },

    async leaderboard(input: { period: LeaderboardPeriod; limit: number; source?: string }) {
      const path = `/v1/leaderboard?${query({
        source: input.source,
        period: LEADERBOARD_PERIODS[input.period],
        limit: input.limit,
      })}`;
      return ActivityApiLeaderboardSchema.parse(await get(path)).data;
    },

    async *stream(
      input: { source?: string; type?: string; actor?: string },
      { signal, lastEventId }: { signal?: AbortSignal; lastEventId?: string },
    ) {
      const response = await fetchImplementation(`${baseUrl}/v1/events/stream?${query(input)}`, {
        headers: {
          accept: "text/event-stream",
          ...(lastEventId ? { "last-event-id": lastEventId } : {}),
        },
        signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Activity stream returned ${response.status}`);
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          const { frames, rest } = parseSseFrames(buffer + value);
          buffer = rest;
          for (const frame of frames) {
            yield ActivityApiEventSchema.parse(JSON.parse(frame.data));
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

export type ActivityReaderClient = ReturnType<typeof createActivityReaderClient>;
