import { describe, expect, it } from "vitest";
import {
  createActivityReaderClient,
  isPubliclyVisible,
  parseSseFrames,
  toActivityEvent,
  toActivityQuery,
} from "../services/activity-reader";

const EVENT_ID = "e".repeat(64);

describe("activity reader", () => {
  it("translates legacy filters into Activity's source and Event Type", () => {
    expect(toActivityQuery({})).toEqual({ type: undefined, actor: undefined });
    expect(toActivityQuery({ actor: "" })).toEqual({ type: undefined, actor: undefined });
    expect(toActivityQuery({ source: "projects", actor: "alice.near" })).toEqual({
      source: "nearbuilders",
      type: "project.approved",
      actor: "alice.near",
    });
    expect(toActivityQuery({ source: "nearcatalog", type: "claim" })).toEqual({
      source: "nearbuilders",
      type: "nearcatalog.claim",
      actor: undefined,
    });
    expect(toActivityQuery({ source: "projects", type: "claim" })).toEqual(null);
    expect(toActivityQuery({ source: "kudos-board", type: "kudos.given" })).toEqual({
      source: "kudos-board",
      type: "kudos.given",
      actor: undefined,
    });
  });

  it("keeps nearbuilders.org's own events in their legacy shape and ID", () => {
    expect(
      toActivityEvent(
        {
          id: EVENT_ID,
          source: "nearbuilders",
          type: "project.approved",
          actor: "alice.near",
          timestamp: "2026-07-10T09:00:00.000Z",
          payload: { title: "Approved" },
        },
        new Map([[EVENT_ID, "act_1"]]),
      ),
    ).toEqual({
      id: "act_1",
      source: "projects",
      type: "approved",
      actor: "alice.near",
      payload: { title: "Approved" },
      verified: true,
      hiddenAt: null,
      createdAt: "2026-07-10T09:00:00.000Z",
    });
  });

  it("shows other sources without their unverified payload", () => {
    expect(
      toActivityEvent(
        {
          id: EVENT_ID,
          source: "kudos-board",
          type: "kudos.given",
          actor: "bob.near",
          timestamp: "2026-10-10T09:00:00.000Z",
          payload: { title: "Look at this", mediaUrl: "https://example.com/x.png" },
        },
        new Map(),
      ),
    ).toEqual({
      id: EVENT_ID,
      source: "kudos-board",
      type: "kudos.given",
      actor: "bob.near",
      payload: null,
      verified: false,
      hiddenAt: null,
      createdAt: "2026-10-10T09:00:00.000Z",
    });
  });

  it("parses complete SSE frames and keeps a partial one for the next chunk", () => {
    const { frames, rest } = parseSseFrames(
      `: ping\n\nevent: message\nretry: 1000\nid: ${EVENT_ID}\ndata: {"a":1}\n\nevent: message\nid: x\ndata: {"b"`,
    );
    expect(frames).toEqual([{ id: EVENT_ID, data: '{"a":1}' }]);
    expect(rest).toBe('event: message\nid: x\ndata: {"b"');
  });

  it("queries Activity's feed and leaderboard", async () => {
    const urls: string[] = [];
    const client = createActivityReaderClient({
      baseUrl: "https://activity.nearbuilders.org/api/",
      fetchImplementation: async (input) => {
        urls.push(String(input));
        const body = String(input).includes("/leaderboard")
          ? {
              data: [
                {
                  rank: 1,
                  actor: "alice.near",
                  score: 25,
                  eventCount: 2,
                  breakdown: [{ source: "nearbuilders" }, { source: "kudos-board" }],
                },
              ],
            }
          : { data: [], meta: { hasMore: true, nextCursor: "next" } };
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });

    await expect(
      client.listEvents({ source: "nearbuilders", actor: "alice.near", limit: 20, cursor: "c1" }),
    ).resolves.toEqual({ data: [], nextCursor: "next" });
    await expect(client.leaderboard({ period: "week", limit: 10 })).resolves.toEqual([
      {
        rank: 1,
        actor: "alice.near",
        score: 25,
        eventCount: 2,
        breakdown: [{ source: "nearbuilders" }, { source: "kudos-board" }],
      },
    ]);
    expect(urls).toEqual([
      "https://activity.nearbuilders.org/api/v1/events?source=nearbuilders&actor=alice.near&limit=20&cursor=c1",
      "https://activity.nearbuilders.org/api/v1/leaderboard?period=weekly&limit=10",
    ]);
  });

  it("streams events from Activity across chunk boundaries", async () => {
    const encoder = new TextEncoder();
    const event = {
      id: EVENT_ID,
      source: "x",
      type: "x.done",
      actor: "a.near",
      timestamp: "2026-10-10T09:00:00.000Z",
      payload: {},
    };
    const json = JSON.stringify(event);
    const chunks = [`id: ${EVENT_ID}\ndata: ${json.slice(0, 20)}`, `${json.slice(20)}\n\n`];
    let headers: Headers | undefined;
    const client = createActivityReaderClient({
      baseUrl: "https://activity.nearbuilders.org/api",
      fetchImplementation: async (_input, init) => {
        headers = new Headers(init?.headers);
        return new Response(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
              controller.close();
            },
          }),
          { status: 200 },
        );
      },
    });

    const received = [];
    for await (const event of client.stream({ source: "x" }, { lastEventId: "prev" })) {
      received.push(event);
    }
    expect(received).toEqual([event]);
    expect(headers?.get("last-event-id")).toBe("prev");
  });

  it("keeps sources under review off nearbuilders.org, but always shows its own source", () => {
    const event = { id: EVENT_ID, actor: "a.near", timestamp: "", payload: null };
    expect(
      isPubliclyVisible({
        ...event,
        source: "kudos",
        type: "k",
        provenance: { approvalStatus: "approved" },
      }),
    ).toBe(true);
    expect(
      isPubliclyVisible({
        ...event,
        source: "kudos",
        type: "k",
        provenance: { approvalStatus: "pending" },
      }),
    ).toBe(false);
    expect(isPubliclyVisible({ ...event, source: "nearbuilders", type: "project.approved" })).toBe(
      true,
    );
    expect(
      isPubliclyVisible({ ...event, source: "staging", type: "project.approved" }, "staging"),
    ).toBe(true);
  });

  it("maps a configured own source the same way as nearbuilders", () => {
    expect(toActivityQuery({ source: "builders" }, "staging")).toEqual({
      source: "staging",
      type: "builder.approved",
      actor: undefined,
    });
    expect(
      toActivityEvent(
        {
          id: EVENT_ID,
          source: "staging",
          type: "builder.approved",
          actor: "a.near",
          timestamp: "t",
          payload: {},
        },
        new Map(),
        "staging",
      ),
    ).toMatchObject({ source: "builders", type: "approved", verified: true });
  });

  it("rejects a response that does not match Activity's feed", async () => {
    const client = createActivityReaderClient({
      baseUrl: "https://activity.nearbuilders.org/api",
      fetchImplementation: async () =>
        new Response(JSON.stringify({ data: [{ id: 1 }], meta: {} }), { status: 200 }),
    });

    await expect(client.listEvents({ limit: 10 })).rejects.toThrow();
  });
});
