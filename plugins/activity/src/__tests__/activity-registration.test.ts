import { ORPCError } from "@orpc/server";
import { afterEach, describe, expect, it } from "vitest";
import { activitySiteUrl } from "../services/activity-api";
import { createActivityReaderClient } from "../services/activity-reader";
import { createActivityRegistrationClient } from "../services/activity-registration";
import { startFakeActivity } from "./fake-activity";

type FakeActivity = Awaited<ReturnType<typeof startFakeActivity>>;

describe("activity registration client", () => {
  const running: FakeActivity[] = [];

  afterEach(async () => {
    await Promise.all(running.splice(0).map((activity) => activity.close()));
  });

  async function registrationWith(handlers: Parameters<typeof startFakeActivity>[0]) {
    const activity = await startFakeActivity(handlers);
    running.push(activity);
    const client = createActivityRegistrationClient({
      baseUrl: `${activity.url}/api/`,
      apiKey: "act_partner",
      reader: createActivityReaderClient({ client: activity.client }),
    });
    return { client, activity };
  }

  it("starts a partner binding session with the trusted key and the project", async () => {
    const { client, activity } = await registrationWith({
      createActivityBindingSession: () => ({
        sessionId: "abs_x",
        url: "https://activity.nearbuilders.org/binding?sessionToken=abs_x",
        delivery: "page",
        matchCode: "1234",
        expiresAt: "2026-10-10T12:00:00.000Z",
        draft: {},
      }),
    });

    const session = await client.startSession({
      projectId: "proj_1",
      nearAccountId: "owner.near",
      eventTypes: [{ name: "listing.published", pointValue: 10 }],
    });

    expect(session).toEqual({
      url: "https://activity.nearbuilders.org/binding?sessionToken=abs_x",
      expiresAt: "2026-10-10T12:00:00.000Z",
    });
    expect(activity.calls).toEqual([
      expect.objectContaining({
        procedure: "createActivityBindingSession",
        authorization: "Bearer act_partner",
        input: {
          project: { id: "proj_1" },
          nearAccountId: "owner.near",
          eventTypes: [
            { name: "listing.published", description: "", enabled: true, pointValue: 10 },
          ],
        },
      }),
    ]);
  });

  it("reads a project's Activity status without the key", async () => {
    const { client, activity } = await registrationWith({
      getNearbuildersProjectActivity: () => ({
        status: "tracked",
        sourceId: "proptix",
        displayName: "Proptix",
        approvalStatus: "approved",
        reviewReason: null,
      }),
    });

    await expect(client.projectStatus("proj_1")).resolves.toEqual({
      status: "tracked",
      sourceId: "proptix",
      displayName: "Proptix",
      reviewReason: null,
      activityUrl: activity.url,
    });
    expect(activity.calls).toEqual([
      expect.objectContaining({
        procedure: "getNearbuildersProjectActivity",
        input: { projectId: "proj_1" },
        authorization: undefined,
      }),
    ]);
  });

  it("surfaces Activity's error message", async () => {
    const { client } = await registrationWith({
      createActivityBindingSession: () => {
        throw new ORPCError("FORBIDDEN", {
          message: "Only approved, trusted Activity Sources can start partner binding sessions",
        });
      },
    });

    await expect(
      client.startSession({ projectId: "proj_1", eventTypes: [{ name: "a.b", pointValue: 1 }] }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only approved, trusted Activity Sources can start partner binding sessions",
    });
  });

  it("reports an unreachable Activity as unavailable", async () => {
    const client = createActivityRegistrationClient({
      baseUrl: "http://127.0.0.1:1/api",
      apiKey: "act_partner",
      reader: createActivityReaderClient({ client: undefined }),
    });

    await expect(
      client.startSession({ projectId: "proj_1", eventTypes: [{ name: "a.b", pointValue: 1 }] }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(client.projectStatus("proj_1")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("derives the Activity site from the gateway URL", () => {
    expect(activitySiteUrl("https://activity.nearbuilders.org/api")).toBe(
      "https://activity.nearbuilders.org",
    );
    expect(activitySiteUrl("http://localhost:3000/api/")).toBe("http://localhost:3000");
  });

  describe("project activity", () => {
    const status =
      (value: string, sourceId: string | null = "kudos-board") =>
      () => ({
        status: value,
        sourceId,
        displayName: "Kudos Board",
        approvalStatus: null,
        reviewReason: null,
      });

    it("lists a tracked project's own events and marks events under review", async () => {
      const { client, activity } = await registrationWith({
        getNearbuildersProjectActivity: status("tracked"),
        listActivityEvents: () => ({
          data: [
            {
              id: "a".repeat(64),
              type: "kudos.given",
              actor: "alice.near",
              timestamp: "2026-10-10T10:00:00.000Z",
              source: "kudos-board",
              payload: {},
              provenance: { approvalStatus: "pending" },
            },
            {
              id: "b".repeat(64),
              type: "kudos.received",
              actor: "bob.near",
              timestamp: "2026-10-10T09:00:00.000Z",
              source: "kudos-board",
              payload: {},
              provenance: { approvalStatus: "approved" },
            },
          ],
          meta: { hasMore: true, nextCursor: "next-page", skippedInvalid: 0 },
        }),
      });

      const page = await client.projectEvents("proj_1", "this-page");

      expect(activity.calls[1]).toMatchObject({
        procedure: "listActivityEvents",
        input: { source: "kudos-board", limit: 10, cursor: "this-page" },
      });
      expect(page).toEqual({
        events: [
          {
            id: "a".repeat(64),
            type: "kudos.given",
            actor: "alice.near",
            occurredAt: "2026-10-10T10:00:00.000Z",
            underReview: true,
          },
          {
            id: "b".repeat(64),
            type: "kudos.received",
            actor: "bob.near",
            occurredAt: "2026-10-10T09:00:00.000Z",
            underReview: false,
          },
        ],
        nextCursor: "next-page",
      });
    });

    it("ends pagination when Activity has no more events", async () => {
      const { client } = await registrationWith({
        getNearbuildersProjectActivity: status("connected"),
        listActivityEvents: () => ({
          data: [],
          meta: { hasMore: false, nextCursor: "ignored", skippedInvalid: 0 },
        }),
      });

      await expect(client.projectEvents("proj_1")).resolves.toEqual({
        events: [],
        nextCursor: null,
      });
    });

    it("reads the project's all-time top contributors", async () => {
      const { client, activity } = await registrationWith({
        getNearbuildersProjectActivity: status("tracked"),
        getActivityLeaderboard: () => ({
          data: [{ rank: 1, actor: "alice.near", score: 30, eventCount: 3, breakdown: [] }],
        }),
      });

      await expect(client.projectContributors("proj_1")).resolves.toEqual([
        { rank: 1, actor: "alice.near", score: 30, eventCount: 3 },
      ]);
      expect(activity.calls[1]).toMatchObject({
        procedure: "getActivityLeaderboard",
        input: { source: "kudos-board", period: "all-time", limit: 5 },
      });
    });

    it.each([
      "none",
      "rejected",
    ])("returns nothing for a %s project without querying events", async (value) => {
      const { client, activity } = await registrationWith({
        getNearbuildersProjectActivity: status(value, value === "none" ? null : "kudos-board"),
      });

      await expect(client.projectEvents("proj_1")).resolves.toEqual({
        events: [],
        nextCursor: null,
      });
      await expect(client.projectContributors("proj_1")).resolves.toEqual([]);
      expect(activity.calls.map(({ procedure }) => procedure)).toEqual([
        "getNearbuildersProjectActivity",
      ]);
    });
  });
});
