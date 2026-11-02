import { ORPCError } from "@orpc/server";
import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it } from "vitest";
import ApiPlugin from "../../src/index";
import { asPluginEntries } from "../helpers/plugin-entries";

type ProposeContext = { canResubmitForOthers?: boolean };

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

const timestamp = "2026-10-31T00:00:00.000Z";

const project = {
  id: "proj_owned",
  ownerId: "owner.near",
  organizationId: null,
  collaborators: [
    { collaboratorOwnerId: "collab.near", status: "accepted" },
    { collaboratorOwnerId: "invited.near", status: "pending" },
  ],
};

describe("propose for an existing project or event", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadApi() {
    const proposeContexts: ProposeContext[] = [];
    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    const loaded = await runtime.usePlugin(
      "api",
      { variables: {}, secrets: { API_DATABASE_URL: "pglite::memory:" } },
      asPluginEntries({
        activity: () => ({}),
        builders: () => ({}),
        events: () => ({
          getEvent: async ({ id }: { id: string }) => {
            if (id !== "evt_owned")
              throw new ORPCError("NOT_FOUND", { message: "Event not found" });
            return { data: { id, ownerId: "owner.near" } };
          },
        }),
        nearcatalog: () => ({}),
        notifications: () => ({}),
        projects: () => ({
          getProject: async ({ id }: { id: string }) => {
            if (id !== project.id) {
              throw new ORPCError("NOT_FOUND", { message: "Project not found" });
            }
            return { data: project };
          },
        }),
        proposals: (context: ProposeContext) => ({
          propose: async (input: Record<string, unknown>) => {
            proposeContexts.push(context);
            return {
              data: {
                id: `proposal-${String(input.entityId)}`,
                pluginId: String(input.pluginId),
                entityId: String(input.entityId),
                operation: "create",
                payload: input.payload,
                schemaVersion: "1",
                createdBy: "owner.near",
                reviewStatus: "pending",
                applyStatus: "not_started",
                removeStatus: "not_started",
                rejectionReason: null,
                applyError: null,
                removeError: null,
                appliedResourceId: null,
                submissionCount: 1,
                appliedAt: null,
                removedAt: null,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            };
          },
        }),
        votes: () => ({}),
      } as never),
    );
    return { loaded, proposeContexts };
  }

  it("lets owners and accepted collaborators resubmit, and nobody else", async () => {
    const { loaded, proposeContexts } = await loadApi();
    const submit = (userId: string, nearAccount: string, pluginId: string, entityId: string) =>
      loaded
        .createClient(memberContext(userId, nearAccount))
        .propose({ pluginId, entityId, payload: { title: "Edit" } });

    await submit("owner", "owner.near", "projects", "proj_owned");
    await submit("collab", "collab.near", "projects", "proj_owned");
    await submit("invited", "invited.near", "projects", "proj_owned");
    await submit("stranger", "stranger.near", "projects", "proj_owned");
    await submit("stranger", "stranger.near", "projects", "proj_missing");
    await submit("owner", "owner.near", "events", "evt_owned");
    await submit("stranger", "stranger.near", "events", "evt_owned");

    expect(proposeContexts.map((context) => context.canResubmitForOthers)).toEqual([
      true,
      true,
      false,
      false,
      false,
      true,
      false,
    ]);
  });
});
