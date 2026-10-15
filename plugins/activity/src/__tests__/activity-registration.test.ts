import { describe, expect, it } from "vitest";
import {
  activitySiteUrl,
  createActivityRegistrationClient,
} from "../services/activity-registration";

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("activity registration client", () => {
  it("starts a partner binding session with the trusted key and the project", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const client = createActivityRegistrationClient({
      baseUrl: "https://activity.nearbuilders.org/api/",
      apiKey: "act_partner",
      fetchImplementation: async (input, init) => {
        requests.push({ url: String(input), init: init ?? {} });
        return respond({
          url: "https://activity.nearbuilders.org/binding?sessionToken=abs_x",
          expiresAt: "2026-10-10T12:00:00.000Z",
          delivery: "page",
        });
      },
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
    expect(requests[0]?.url).toBe("https://activity.nearbuilders.org/api/v1/binding-sessions");
    expect(new Headers(requests[0]?.init.headers).get("authorization")).toBe("Bearer act_partner");
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      project: { id: "proj_1" },
      nearAccountId: "owner.near",
      eventTypes: [{ name: "listing.published", description: "", enabled: true, pointValue: 10 }],
    });
  });

  it("reads a project's Activity status without the key", async () => {
    let headers: Headers | undefined;
    const client = createActivityRegistrationClient({
      baseUrl: "https://activity.nearbuilders.org/api",
      apiKey: "act_partner",
      fetchImplementation: async (input, init) => {
        headers = new Headers(init?.headers);
        expect(String(input)).toBe(
          "https://activity.nearbuilders.org/api/v1/projects/proj_1/activity",
        );
        return respond({
          status: "tracked",
          sourceId: "proptix",
          displayName: "Proptix",
          approvalStatus: "approved",
          reviewReason: null,
        });
      },
    });

    await expect(client.projectStatus("proj_1")).resolves.toEqual({
      status: "tracked",
      sourceId: "proptix",
      displayName: "Proptix",
      reviewReason: null,
      activityUrl: "https://activity.nearbuilders.org",
    });
    expect(headers?.get("authorization")).toBeNull();
  });

  it("surfaces Activity's error message", async () => {
    const client = createActivityRegistrationClient({
      baseUrl: "https://activity.nearbuilders.org/api",
      apiKey: "act_partner",
      fetchImplementation: async () =>
        respond(
          { message: "Only approved, trusted Activity Sources can start partner binding sessions" },
          403,
        ),
    });

    await expect(
      client.startSession({ projectId: "proj_1", eventTypes: [{ name: "a.b", pointValue: 1 }] }),
    ).rejects.toThrow("Only approved, trusted Activity Sources can start partner binding sessions");
  });

  it("derives the Activity site from the gateway URL", () => {
    expect(activitySiteUrl("https://activity.nearbuilders.org/api")).toBe(
      "https://activity.nearbuilders.org",
    );
    expect(activitySiteUrl("http://localhost:3000/api/")).toBe("http://localhost:3000");
  });

  describe("project activity", () => {
    const status = (value: string, sourceId: string | null = "kudos-board") =>
      respond({ status: value, sourceId, displayName: "Kudos Board", reviewReason: null });

    function clientWith(responses: (url: string) => Response) {
      const urls: string[] = [];
      const client = createActivityRegistrationClient({
        baseUrl: "https://activity.nearbuilders.org/api",
        apiKey: "act_partner",
        fetchImplementation: async (input) => {
          urls.push(String(input));
          return responses(String(input));
        },
      });
      return { client, urls };
    }

    it("lists a tracked project's own events and marks events under review", async () => {
      const { client, urls } = clientWith((url) =>
        url.includes("/v1/projects/")
          ? status("tracked")
          : respond({
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
              meta: { hasMore: true, nextCursor: "next-page" },
            }),
      );

      const page = await client.projectEvents("proj_1", "this-page");

      expect(urls[1]).toBe(
        "https://activity.nearbuilders.org/api/v1/events?source=kudos-board&limit=10&cursor=this-page",
      );
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
      const { client } = clientWith((url) =>
        url.includes("/v1/projects/")
          ? status("connected")
          : respond({ data: [], meta: { hasMore: false, nextCursor: "ignored" } }),
      );

      await expect(client.projectEvents("proj_1")).resolves.toEqual({
        events: [],
        nextCursor: null,
      });
    });

    it("reads the project's all-time top contributors", async () => {
      const { client, urls } = clientWith((url) =>
        url.includes("/v1/projects/")
          ? status("tracked")
          : respond({
              data: [{ rank: 1, actor: "alice.near", score: 30, eventCount: 3, breakdown: [] }],
            }),
      );

      await expect(client.projectContributors("proj_1")).resolves.toEqual([
        { rank: 1, actor: "alice.near", score: 30, eventCount: 3 },
      ]);
      expect(urls[1]).toBe(
        "https://activity.nearbuilders.org/api/v1/leaderboard?source=kudos-board&period=all-time&limit=5",
      );
    });

    it.each([
      "none",
      "rejected",
    ])("returns nothing for a %s project without querying events", async (value) => {
      const { client, urls } = clientWith(() =>
        status(value, value === "none" ? null : "kudos-board"),
      );

      await expect(client.projectEvents("proj_1")).resolves.toEqual({
        events: [],
        nextCursor: null,
      });
      await expect(client.projectContributors("proj_1")).resolves.toEqual([]);
      expect(urls.every((url) => url.includes("/v1/projects/"))).toBe(true);
    });
  });
});
