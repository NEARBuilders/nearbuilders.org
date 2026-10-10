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
});
