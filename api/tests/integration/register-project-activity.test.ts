import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";
import { asPluginEntries } from "../helpers/plugin-entries";

type ActivityContext = { activityRegistration?: boolean };

function memberContext(userId: string, nearAccount: string) {
  return {
    userId,
    user: {
      id: userId,
      name: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      role: "member",
      isAnonymous: false,
      locale: null,
    },
    near: { primaryAccountId: nearAccount, linkedAccounts: [], hasNearAccount: true },
  };
}

describe("registerProjectActivity", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadApi() {
    const activityContexts: ActivityContext[] = [];
    const startActivityRegistration = vi.fn(async () => ({
      url: "https://activity.example/bind",
      expiresAt: "2026-11-01T00:00:00.000Z",
    }));
    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    const loaded = await runtime.usePlugin(
      "api",
      { variables: {}, secrets: { API_DATABASE_URL: "pglite::memory:" } },
      asPluginEntries({
        activity: (context: ActivityContext) => {
          activityContexts.push(context);
          return { startActivityRegistration };
        },
        builders: () => ({}),
        events: () => ({}),
        nearcatalog: () => ({}),
        notifications: () => ({}),
        projects: () => ({
          getProject: async ({ id }: { id: string }) => ({
            data: {
              id,
              ownerId: "owner.near",
              kind: "project",
              status: "active",
              visibility: "public",
            },
          }),
        }),
        proposals: () => ({
          getProposals: async () => ({
            data: [],
            meta: { total: 0, hasMore: false, nextCursor: null },
          }),
        }),
        votes: () => ({}),
      } as never),
    );
    return { loaded, activityContexts, startActivityRegistration };
  }

  const input = { projectId: "proj_owned", eventTypes: [{ name: "commit", pointValue: 1 }] };

  it("refuses callers who don't own the project", async () => {
    const { loaded, startActivityRegistration } = await loadApi();
    await expect(
      loaded
        .createClient(memberContext("stranger", "stranger.near"))
        .registerProjectActivity(input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(startActivityRegistration).not.toHaveBeenCalled();
  });

  it("starts registration for the owner through the core handler", async () => {
    const { loaded, activityContexts, startActivityRegistration } = await loadApi();
    const session = await loaded
      .createClient(memberContext("owner", "owner.near"))
      .registerProjectActivity(input);
    expect(session.url).toBe("https://activity.example/bind");
    expect(startActivityRegistration).toHaveBeenCalledWith({
      ...input,
      nearAccountId: "owner.near",
    });
    expect(activityContexts.at(-1)?.activityRegistration).toBe(true);
  });
});
