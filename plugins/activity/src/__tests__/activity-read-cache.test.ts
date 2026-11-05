import { describe, expect, it } from "vitest";
import type { ActivityApiEvent } from "../services/activity-api";
import {
  type ActivityReaderClient,
  createSharedActivityStream,
  withReadCache,
} from "../services/activity-reader";
import { createActivityRegistrationClient } from "../services/activity-registration";
import { createTtlCache } from "../services/ttl-cache";

function event(id: string): ActivityApiEvent {
  return {
    id,
    source: "kudos-board",
    type: "kudos.given",
    actor: "a.near",
    timestamp: "2026-10-10T09:00:00.000Z",
    payload: {},
  };
}

describe("ttl cache", () => {
  it("shares a load until it expires", async () => {
    let clock = 0;
    let loads = 0;
    const cache = createTtlCache<number>({ ttlMs: 100, maxEntries: 10, now: () => clock });
    const load = async () => {
      loads += 1;
      return loads;
    };

    const [first, second] = await Promise.all([cache.get("k", load), cache.get("k", load)]);
    expect([first, second, loads]).toEqual([1, 1, 1]);

    clock = 101;
    await expect(cache.get("k", load)).resolves.toBe(2);
  });

  it("never serves a failed load", async () => {
    const cache = createTtlCache<string>({ ttlMs: 1_000, maxEntries: 10 });
    await expect(cache.get("k", async () => Promise.reject(new Error("down")))).rejects.toThrow(
      "down",
    );
    await expect(cache.get("k", async () => "ok")).resolves.toBe("ok");
  });

  it("drops the oldest entries past its size", async () => {
    let loads = 0;
    const cache = createTtlCache<number>({ ttlMs: 1_000, maxEntries: 2 });
    const load = async () => ++loads;
    await cache.get("a", load);
    await cache.get("b", load);
    await cache.get("c", load);
    await cache.get("a", load);
    expect(loads).toBe(4);
  });
});

describe("cached reader", () => {
  it("makes one request for identical reads and separate ones for different reads", async () => {
    const calls: string[] = [];
    const reader: ActivityReaderClient = {
      async listEvents(input) {
        calls.push(`events:${input.source}`);
        return { data: [], nextCursor: null };
      },
      async leaderboard(input) {
        calls.push(`leaderboard:${input.period}`);
        return [];
      },
      stream: async function* () {},
    };
    const cached = withReadCache(reader);

    await Promise.all([
      cached.listEvents({ source: "a", limit: 10 }),
      cached.listEvents({ source: "a", limit: 10 }),
      cached.listEvents({ source: "b", limit: 10 }),
      cached.leaderboard({ period: "week", limit: 10 }),
      cached.leaderboard({ period: "week", limit: 10 }),
    ]);

    expect(calls).toEqual(["events:a", "events:b", "leaderboard:week"]);
  });

  it("looks a project's status up once for its section", async () => {
    const urls: string[] = [];
    const client = createActivityRegistrationClient({
      baseUrl: "https://activity.nearbuilders.org/api",
      apiKey: "act_partner",
      fetchImplementation: async (input) => {
        urls.push(String(input));
        const body = String(input).includes("/v1/projects/")
          ? { status: "tracked", sourceId: "kudos-board", displayName: "Kudos", reviewReason: null }
          : String(input).includes("/leaderboard")
            ? { data: [] }
            : { data: [], meta: { hasMore: false, nextCursor: null } };
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });

    await client.projectStatus("proj_1");
    await client.projectEvents("proj_1");
    await client.projectContributors("proj_1");

    expect(urls.filter((url) => url.includes("/v1/projects/"))).toHaveLength(1);
  });
});

describe("shared live stream", () => {
  function controllableReader() {
    const opened: Array<{ lastEventId?: string; signal?: AbortSignal }> = [];
    const pending: Array<(value: ActivityApiEvent | null) => void> = [];
    const reader: Pick<ActivityReaderClient, "stream"> = {
      async *stream(_input, options) {
        opened.push(options);
        for (;;) {
          const next = await new Promise<ActivityApiEvent | null>((resolve) => {
            pending.push(resolve);
            options.signal?.addEventListener("abort", () => resolve(null));
          });
          if (!next) return;
          yield next;
        }
      },
    };
    const settle = async () => {
      for (let attempt = 0; attempt < 50 && pending.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    };
    const emit = async (value: ActivityApiEvent | null) => {
      await settle();
      pending.shift()?.(value);
    };
    return { reader, opened, emit, settle };
  }

  it("fans one upstream connection out to every subscriber and closes it with the last", async () => {
    const { reader, opened, emit } = controllableReader();
    const shared = createSharedActivityStream(reader, { retryMs: [1] });
    const first = new AbortController();
    const second = new AbortController();
    const a = shared.subscribe({ signal: first.signal });
    const b = shared.subscribe({ signal: second.signal });

    const nextA = a.next();
    const nextB = b.next();
    await emit(event("e1"));
    expect((await nextA).value?.id).toBe("e1");
    expect((await nextB).value?.id).toBe("e1");
    expect(opened).toHaveLength(1);

    first.abort();
    await a.return(undefined);
    expect(opened[0]?.signal?.aborted).toBe(false);
    second.abort();
    await b.return(undefined);
    expect(opened[0]?.signal?.aborted).toBe(true);
    expect(shared.subscribers).toBe(0);
  });

  it("reconnects from the last event after Activity closes the stream", async () => {
    const { reader, opened, emit } = controllableReader();
    const shared = createSharedActivityStream(reader, { retryMs: [1] });
    const stop = new AbortController();
    const subscription = shared.subscribe({ signal: stop.signal });

    const first = subscription.next();
    await emit(event("e1"));
    await first;
    const second = subscription.next();
    await emit(null);
    await emit(event("e2"));
    expect((await second).value?.id).toBe("e2");
    expect(opened.map(({ lastEventId }) => lastEventId)).toEqual([undefined, "e1"]);

    stop.abort();
    await subscription.return(undefined);
  });

  it("drains a subscriber aborted while suspended at a yield, without waiting for return()", async () => {
    const { reader, opened, emit } = controllableReader();
    const shared = createSharedActivityStream(reader, { retryMs: [1] });
    const stop = new AbortController();
    const subscription = shared.subscribe({ signal: stop.signal });

    const first = subscription.next();
    await emit(event("e1"));
    expect((await first).value?.id).toBe("e1");
    expect(shared.subscribers).toBe(1);

    stop.abort();
    expect(shared.subscribers).toBe(0);
    expect(opened[0]?.signal?.aborted).toBe(true);
    expect(await subscription.next()).toEqual({ done: true, value: undefined });
  });

  it("stops queueing for an aborted subscriber while others keep receiving", async () => {
    const { reader, emit } = controllableReader();
    const shared = createSharedActivityStream(reader, { retryMs: [1] });
    const gone = new AbortController();
    const stays = new AbortController();
    const abandoned = shared.subscribe({ signal: gone.signal });
    const live = shared.subscribe({ signal: stays.signal });

    const abandonedFirst = abandoned.next();
    const liveFirst = live.next();
    await emit(event("e1"));
    await abandonedFirst;
    await liveFirst;

    gone.abort();
    expect(shared.subscribers).toBe(1);
    const liveSecond = live.next();
    await emit(event("e2"));
    expect((await liveSecond).value?.id).toBe("e2");
    expect(await abandoned.next()).toEqual({ done: true, value: undefined });

    stays.abort();
    expect(shared.subscribers).toBe(0);
  });

  it("buffers at most the cap for a consumer that stops pulling, dropping the oldest first", async () => {
    const { reader, emit, settle } = controllableReader();
    const shared = createSharedActivityStream(reader, { retryMs: [1], maxQueuedEvents: 3 });
    const stop = new AbortController();
    const subscription = shared.subscribe({ signal: stop.signal });

    const first = subscription.next();
    await emit(event("e0"));
    expect((await first).value?.id).toBe("e0");
    for (const id of ["e1", "e2", "e3", "e4", "e5"]) await emit(event(id));
    await settle();

    const received: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      received.push((await subscription.next()).value?.id ?? "");
    }
    expect(received).toEqual(["e3", "e4", "e5"]);

    stop.abort();
  });

  it("delivers every event in order to a consumer that keeps up, regardless of the cap", async () => {
    const { reader, emit } = controllableReader();
    const shared = createSharedActivityStream(reader, { retryMs: [1], maxQueuedEvents: 1 });
    const stop = new AbortController();
    const subscription = shared.subscribe({ signal: stop.signal });

    const received: string[] = [];
    for (const id of ["e1", "e2", "e3", "e4"]) {
      const next = subscription.next();
      await emit(event(id));
      received.push((await next).value?.id ?? "");
    }
    expect(received).toEqual(["e1", "e2", "e3", "e4"]);

    stop.abort();
  });

  it("drains a subscriber with no abort signal once its consumer returns", async () => {
    const { reader, opened, emit } = controllableReader();
    const shared = createSharedActivityStream(reader, { retryMs: [1] });
    const subscription = shared.subscribe();

    const first = subscription.next();
    await emit(event("e1"));
    await first;
    expect(shared.subscribers).toBe(1);

    await subscription.return(undefined);
    expect(shared.subscribers).toBe(0);
    expect(opened[0]?.signal?.aborted).toBe(true);
  });
});
