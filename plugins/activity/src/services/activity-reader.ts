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
import { createTtlCache } from "./ttl-cache";

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

/** Activity's host rate-limits per IP, and every nearbuilders.org visitor reads through one. */
export function withReadCache(
  reader: ActivityReaderClient,
  options: { ttlMs?: number; maxEntries?: number; now?: () => number } = {},
): ActivityReaderClient & { clear(): void } {
  const settings = {
    ttlMs: options.ttlMs ?? 30_000,
    maxEntries: options.maxEntries ?? 500,
    now: options.now,
  };
  const events = createTtlCache<Awaited<ReturnType<ActivityReaderClient["listEvents"]>>>(settings);
  const leaderboards =
    createTtlCache<Awaited<ReturnType<ActivityReaderClient["leaderboard"]>>>(settings);
  return {
    ...reader,
    listEvents: (input) => events.get(JSON.stringify(input), () => reader.listEvents(input)),
    leaderboard: (input) =>
      leaderboards.get(JSON.stringify(input), () => reader.leaderboard(input)),
    clear() {
      events.clear();
      leaderboards.clear();
    },
  };
}

const STREAM_RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

/**
 * One upstream connection to Activity's live stream, shared by every subscriber in this process.
 * It opens with the first subscriber, closes with the last, and reconnects from the last event seen.
 */
export function createSharedActivityStream(
  reader: Pick<ActivityReaderClient, "stream">,
  options: { retryMs?: readonly number[] } = {},
) {
  const retryMs = options.retryMs ?? STREAM_RETRY_MS;
  const listeners = new Set<(event: ActivityApiEvent) => void>();
  let upstream: AbortController | null = null;
  let lastEventId: string | undefined;

  async function run(controller: AbortController): Promise<void> {
    let failures = 0;
    while (!controller.signal.aborted) {
      try {
        for await (const event of reader.stream({}, { signal: controller.signal, lastEventId })) {
          failures = 0;
          lastEventId = event.id;
          for (const listener of listeners) listener(event);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[Activity] Live stream from activity.nearbuilders.org dropped", error);
      }
      if (controller.signal.aborted) return;
      const delay = retryMs[Math.min(failures, retryMs.length - 1)] ?? 0;
      failures += 1;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    get subscribers() {
      return listeners.size;
    },

    async *subscribe({ signal }: { signal?: AbortSignal } = {}): AsyncGenerator<ActivityApiEvent> {
      const queue: ActivityApiEvent[] = [];
      let wake: (() => void) | null = null;
      const listener = (event: ActivityApiEvent) => {
        queue.push(event);
        wake?.();
      };
      const stop = () => wake?.();
      listeners.add(listener);
      signal?.addEventListener("abort", stop);
      if (!upstream) {
        upstream = new AbortController();
        void run(upstream);
      }
      try {
        while (!signal?.aborted) {
          const next = queue.shift();
          if (next) {
            yield next;
            continue;
          }
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
          wake = null;
        }
      } finally {
        listeners.delete(listener);
        signal?.removeEventListener("abort", stop);
        if (listeners.size === 0) {
          upstream?.abort();
          upstream = null;
        }
      }
    },
  };
}
