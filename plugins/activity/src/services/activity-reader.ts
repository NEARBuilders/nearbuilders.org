import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { activitySettings } from "../db/schema";
import { GATEWAY_EVENT_TYPES } from "./activity-gateway";

export const READ_MODES = ["legacy", "activity"] as const;
export type ReadMode = (typeof READ_MODES)[number];

export const READ_MODE_SETTING_KEY = "activity_read_mode";
const DEFAULT_READ_MODE: ReadMode = "legacy";

/** The Activity source nearbuilders.org's own trusted events are published under, by default. */
export const NEARBUILDERS_SOURCE = "nearbuilders";

const LEGACY_BY_EVENT_TYPE = new Map(
  Object.entries(GATEWAY_EVENT_TYPES).map(([legacy, eventType]) => {
    const [source = "", type = ""] = legacy.split(":");
    return [eventType, { source, type }] as const;
  }),
);

export interface ActivityFeedEvent {
  id: string;
  source: string;
  type: string;
  actor: string;
  timestamp: string;
  payload: unknown;
  provenance?: { approvalStatus?: string };
}

/** Sources still under Activity review stay off nearbuilders.org until an administrator approves them. */
export function isPubliclyVisible(
  event: ActivityFeedEvent,
  ownSource: string = NEARBUILDERS_SOURCE,
): boolean {
  return event.source === ownSource || event.provenance?.approvalStatus === "approved";
}

export interface ReaderEvent {
  id: string;
  source: string;
  type: string;
  actor: string;
  payload: unknown;
  verified: boolean;
  hiddenAt: string | null;
  createdAt: string;
}

export interface ReaderFilters {
  source?: string;
  type?: string;
  actor?: string;
}

export type ActivityQuery =
  | { kind: "activity"; source?: string; type?: string; actor?: string }
  | { kind: "empty" };

/**
 * Translates nearbuilders.org's legacy filters into Activity's. Legacy sources such as `projects`
 * are Event Types of the `nearbuilders` source; a legacy type that no forwarded event has matches
 * nothing.
 */
export function toActivityQuery(
  filters: ReaderFilters,
  ownSource: string = NEARBUILDERS_SOURCE,
): ActivityQuery {
  const actor = filters.actor || undefined;
  if (!filters.source) {
    return filters.type
      ? { kind: "activity", type: filters.type, actor }
      : { kind: "activity", actor };
  }
  const forwarded = Object.entries(GATEWAY_EVENT_TYPES).filter(([legacy]) =>
    legacy.startsWith(`${filters.source}:`),
  );
  if (forwarded.length === 0) {
    return { kind: "activity", source: filters.source, type: filters.type, actor };
  }
  const match = filters.type
    ? forwarded.find(([legacy]) => legacy === `${filters.source}:${filters.type}`)
    : forwarded.length === 1
      ? forwarded[0]
      : undefined;
  if (filters.type && !match) return { kind: "empty" };
  return {
    kind: "activity",
    source: ownSource,
    type: match?.[1],
    actor,
  };
}

/**
 * nearbuilders.org's own events keep their legacy source, type, and ID, so existing cards and
 * endorsements keep working. Other sources show only what Activity verifies: no payload claims.
 */
export function toReaderEvent(
  event: ActivityFeedEvent,
  legacyIds: ReadonlyMap<string, string>,
  ownSource: string = NEARBUILDERS_SOURCE,
): ReaderEvent {
  const legacy = event.source === ownSource ? LEGACY_BY_EVENT_TYPE.get(event.type) : undefined;
  if (legacy) {
    return {
      id: legacyIds.get(event.id) ?? event.id,
      source: legacy.source,
      type: legacy.type,
      actor: event.actor,
      payload: event.payload ?? null,
      verified: true,
      hiddenAt: null,
      createdAt: event.timestamp,
    };
  }
  return {
    id: event.id,
    source: event.source,
    type: event.type,
    actor: event.actor,
    payload: null,
    verified: false,
    hiddenAt: null,
    createdAt: event.timestamp,
  };
}

const LEADERBOARD_PERIODS = { week: "weekly", month: "monthly", "all-time": "all-time" } as const;

export interface ActivityReaderClient {
  listEvents(input: {
    source?: string;
    type?: string;
    actor?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ data: ActivityFeedEvent[]; nextCursor: string | null }>;
  leaderboard(input: { period: keyof typeof LEADERBOARD_PERIODS; limit: number }): Promise<
    Array<{
      actor: string;
      score: number;
      eventCount: number;
      breakdown: Array<{ source: string }>;
    }>
  >;
  stream(
    input: { source?: string; type?: string; actor?: string },
    options: { signal?: AbortSignal; lastEventId?: string },
  ): AsyncGenerator<ActivityFeedEvent>;
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

export function createActivityReaderClient(options: {
  baseUrl: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
}): ActivityReaderClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  function query(input: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return params.toString();
  }

  async function get(path: string): Promise<unknown> {
    const response = await fetchImplementation(`${baseUrl}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Activity returned ${response.status}`);
    return response.json();
  }

  return {
    async listEvents(input) {
      const body = (await get(`/v1/events?${query(input)}`)) as {
        data?: ActivityFeedEvent[];
        meta?: { hasMore?: boolean; nextCursor?: string | null };
      };
      return {
        data: body.data ?? [],
        nextCursor: body.meta?.hasMore ? (body.meta.nextCursor ?? null) : null,
      };
    },

    async leaderboard(input) {
      const body = (await get(
        `/v1/leaderboard?${query({ period: LEADERBOARD_PERIODS[input.period], limit: input.limit })}`,
      )) as {
        data?: Array<{
          actor: string;
          score: number;
          eventCount: number;
          breakdown?: Array<{ source: string }>;
        }>;
      };
      return (body.data ?? []).map((entry) => ({ ...entry, breakdown: entry.breakdown ?? [] }));
    },

    async *stream(input, { signal, lastEventId }) {
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
          for (const frame of frames) yield JSON.parse(frame.data) as ActivityFeedEvent;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

export function createReadModeSettings(db: Database, options: { now?: () => Date } = {}) {
  const now = options.now ?? (() => new Date());
  return {
    async get(): Promise<ReadMode> {
      const [row] = await db
        .select()
        .from(activitySettings)
        .where(eq(activitySettings.key, READ_MODE_SETTING_KEY))
        .limit(1);
      const value = row?.value as ReadMode | undefined;
      return value && READ_MODES.includes(value) ? value : DEFAULT_READ_MODE;
    },
    async set(mode: ReadMode): Promise<ReadMode> {
      await db
        .insert(activitySettings)
        .values({ key: READ_MODE_SETTING_KEY, value: mode, updatedAt: now() })
        .onConflictDoUpdate({
          target: activitySettings.key,
          set: { value: mode, updatedAt: now() },
        });
      return mode;
    },
  };
}
