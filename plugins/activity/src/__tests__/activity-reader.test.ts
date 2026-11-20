import { withEventMeta } from "@orpc/server";
import { describe, expect, it } from "vitest";
import type { ActivityApiEvent } from "../services/activity-api";
import {
  createActivityReaderClient,
  isPubliclyVisible,
  toActivityEvent,
  toActivityQuery,
} from "../services/activity-reader";
import { startFakeActivity } from "./fake-activity";

const EVENT_ID = "e".repeat(64);

function apiEvent(
  event: Partial<Omit<ActivityApiEvent, "provenance">> & { approvalStatus?: string },
): ActivityApiEvent {
  const { approvalStatus, ...rest } = event;
  return {
    id: EVENT_ID,
    source: "nearbuilders",
    type: "project.approved",
    actor: "a.near",
    idempotencyKey: "k",
    timestamp: "2026-10-10T09:00:00.000Z",
    payload: {},
    ...rest,
    provenance: { approvalStatus: approvalStatus ?? "approved" },
  } as ActivityApiEvent;
}

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
        apiEvent({
          actor: "alice.near",
          timestamp: "2026-07-10T09:00:00.000Z",
          payload: { title: "Approved" },
        }),
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
        apiEvent({
          source: "kudos-board",
          type: "kudos.given",
          actor: "bob.near",
          payload: { title: "Look at this", mediaUrl: "https://example.com/x.png" },
        }),
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

  it("queries Activity's feed and leaderboard over its RPC", async () => {
    const leaderboardEntry = {
      rank: 1,
      actor: "alice.near",
      score: 25,
      eventCount: 2,
      breakdown: [{ source: "nearbuilders" }, { source: "kudos-board" }],
    };
    const activity = await startFakeActivity({
      listActivityEvents: () => ({
        data: [],
        meta: { hasMore: true, nextCursor: "next", skippedInvalid: 0 },
      }),
      getActivityLeaderboard: () => ({ data: [leaderboardEntry] }),
    });
    try {
      const client = createActivityReaderClient({ client: activity.client });
      await expect(
        client.listEvents({ source: "nearbuilders", actor: "alice.near", limit: 20, cursor: "c1" }),
      ).resolves.toEqual({ data: [], nextCursor: "next" });
      await expect(client.leaderboard({ period: "week", limit: 10 })).resolves.toEqual([
        leaderboardEntry,
      ]);
      expect(activity.calls.map(({ procedure, input }) => ({ procedure, input }))).toEqual([
        {
          procedure: "listActivityEvents",
          input: { source: "nearbuilders", actor: "alice.near", limit: 20, cursor: "c1" },
        },
        { procedure: "getActivityLeaderboard", input: { period: "weekly", limit: 10 } },
      ]);
    } finally {
      await activity.close();
    }
  });

  it("drops empty filters and ends a feed with no more pages", async () => {
    const activity = await startFakeActivity({
      listActivityEvents: () => ({
        data: [],
        meta: { hasMore: false, nextCursor: "stale", skippedInvalid: 0 },
      }),
    });
    try {
      const client = createActivityReaderClient({ client: activity.client });
      await expect(client.listEvents({ type: "", actor: undefined, limit: 5 })).resolves.toEqual({
        data: [],
        nextCursor: null,
      });
      expect(activity.calls[0]?.input).toEqual({ limit: 5 });
    } finally {
      await activity.close();
    }
  });

  it("streams events from Activity and resumes from the last event ID", async () => {
    const event = apiEvent({ source: "x", type: "x.done" });
    const activity = await startFakeActivity({
      streamActivityEvents: async function* () {
        yield withEventMeta(event, { id: event.id });
      },
    });
    try {
      const client = createActivityReaderClient({ client: activity.client });
      const received = [];
      for await (const next of client.stream({ source: "x" }, { lastEventId: "prev" })) {
        received.push(next);
      }
      expect(received).toEqual([event]);
      expect(activity.calls[0]).toMatchObject({ input: { source: "x" }, lastEventId: "prev" });
    } finally {
      await activity.close();
    }
  });

  it("keeps sources under review off nearbuilders.org, but always shows its own source", () => {
    expect(isPubliclyVisible(apiEvent({ source: "kudos", approvalStatus: "approved" }))).toBe(true);
    expect(isPubliclyVisible(apiEvent({ source: "kudos", approvalStatus: "pending" }))).toBe(false);
    expect(isPubliclyVisible(apiEvent({ approvalStatus: "pending" }))).toBe(true);
    expect(
      isPubliclyVisible(apiEvent({ source: "staging", approvalStatus: "pending" }), "staging"),
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
        apiEvent({ source: "staging", type: "builder.approved", timestamp: "t" }),
        new Map(),
        "staging",
      ),
    ).toMatchObject({ source: "builders", type: "approved", verified: true });
  });

  it("fails reads when Activity is not attached", async () => {
    const client = createActivityReaderClient({ client: undefined });
    await expect(client.listEvents({ limit: 10 })).rejects.toThrow("Activity is not attached");
  });
});
