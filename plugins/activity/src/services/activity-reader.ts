import type { z } from "zod";
import type {
  ActivityEventSchema,
  ActivityFiltersSchema,
  ActivityLeaderboardInputSchema,
} from "../contract";
import type {
  ActivityApiClient,
  ActivityApiEvent,
  ActivityApiLeaderboardEntry,
} from "./activity-api";
import { GATEWAY_EVENT_TYPES } from "./activity-gateway";
import { createTtlCache } from "./ttl-cache";

type ActivityEvent = z.infer<typeof ActivityEventSchema>;
type ActivityFilters = z.infer<typeof ActivityFiltersSchema>;
type LeaderboardPeriod = z.infer<typeof ActivityLeaderboardInputSchema>["period"];

/** The Activity source nearbuilders.org's own trusted events are published under, by default. */
export const NEARBUILDERS_SOURCE = "nearbuilders";

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

function definedOnly<T extends Record<string, string | number | undefined>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ""),
  ) as T;
}

export function createActivityReaderClient(options: {
  client: ActivityApiClient | undefined;
  timeoutMs?: number;
}) {
  const timeoutMs = options.timeoutMs ?? 10_000;

  function api(): ActivityApiClient {
    if (!options.client) throw new Error("Activity is not attached");
    return options.client;
  }

  return {
    async listEvents(input: {
      source?: string;
      type?: string;
      actor?: string;
      limit: number;
      cursor?: string;
    }) {
      const body = await api().listActivityEvents(definedOnly(input), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { data: body.data, nextCursor: body.meta.hasMore ? body.meta.nextCursor : null };
    },

    async leaderboard(input: {
      period: LeaderboardPeriod;
      limit: number;
      source?: string;
    }): Promise<ActivityApiLeaderboardEntry[]> {
      const body = await api().getActivityLeaderboard(
        definedOnly({
          source: input.source,
          period: LEADERBOARD_PERIODS[input.period],
          limit: input.limit,
        }),
        { signal: AbortSignal.timeout(timeoutMs) },
      );
      return body.data;
    },

    async projectActivity(projectId: string) {
      return api().getNearbuildersProjectActivity(
        { projectId },
        { signal: AbortSignal.timeout(timeoutMs) },
      );
    },

    async *stream(
      input: { source?: string; type?: string; actor?: string },
      { signal, lastEventId }: { signal?: AbortSignal; lastEventId?: string },
    ): AsyncGenerator<ActivityApiEvent> {
      const events = await api().streamActivityEvents(definedOnly(input), {
        signal,
        lastEventId,
      });
      for await (const event of events) yield event;
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
 * Most events one live subscriber may hold before the oldest are dropped. A consumer that keeps up
 * holds one or two; a stalled or half-open connection would otherwise grow without bound. A dropped
 * event is missing only from that subscriber's live view; the feed still lists it.
 */
const MAX_QUEUED_EVENTS_PER_SUBSCRIBER = 100;

/**
 * One upstream connection to Activity's live stream, shared by every subscriber in this process.
 * It opens with the first subscriber, closes with the last, and reconnects from the last event seen.
 */
export function createSharedActivityStream(
  reader: Pick<ActivityReaderClient, "stream">,
  options: { retryMs?: readonly number[]; maxQueuedEvents?: number } = {},
) {
  const retryMs = options.retryMs ?? STREAM_RETRY_MS;
  const maxQueuedEvents = options.maxQueuedEvents ?? MAX_QUEUED_EVENTS_PER_SUBSCRIBER;
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
      if (signal?.aborted) return;
      const queue: ActivityApiEvent[] = [];
      let wake: (() => void) | null = null;
      let detached = false;
      const listener = (event: ActivityApiEvent) => {
        if (detached) return;
        queue.push(event);
        if (queue.length > maxQueuedEvents) queue.splice(0, queue.length - maxQueuedEvents);
        wake?.();
      };
      const detach = () => {
        if (detached) return;
        detached = true;
        queue.length = 0;
        listeners.delete(listener);
        signal?.removeEventListener("abort", detach);
        if (listeners.size === 0) {
          upstream?.abort();
          upstream = null;
        }
        wake?.();
      };
      listeners.add(listener);
      signal?.addEventListener("abort", detach);
      if (!upstream) {
        upstream = new AbortController();
        void run(upstream);
      }
      try {
        while (!detached) {
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
        detach();
      }
    },
  };
}

const LIVE_STREAM_DIAGNOSTICS_MS = 5 * 60_000;

/**
 * Logs the live stream's subscriber count beside process RSS every few minutes, so Railway logs
 * show whether subscribers ratchet along with memory or stay with live traffic.
 */
export function startLiveStreamDiagnostics(
  stream: { readonly subscribers: number },
  options: {
    intervalMs?: number;
    log?: (line: string) => void;
    rssBytes?: () => number;
  } = {},
): () => void {
  const log = options.log ?? ((line: string) => console.log(line));
  const rssBytes = options.rssBytes ?? (() => process.memoryUsage.rss());
  const timer = setInterval(() => {
    const rssMb = Math.round(rssBytes() / (1024 * 1024));
    log(`[Activity] Live stream subscribers=${stream.subscribers} rssMB=${rssMb}`);
  }, options.intervalMs ?? LIVE_STREAM_DIAGNOSTICS_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
