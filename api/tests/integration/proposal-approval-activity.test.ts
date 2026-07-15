import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";

const timestamp = "2026-07-15T00:00:00.000Z";

function testNear(primaryAccountId: string) {
  return { primaryAccountId, linkedAccounts: [], hasNearAccount: true };
}

function testUser(id: string, role: string) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    role,
    isAnonymous: false,
  };
}

describe("proposal approval activity lifecycle", () => {
  const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
  const operations: string[] = [];
  const emitTrustedActivity = vi.fn(async () => {
    operations.push("activity");
    return {};
  });
  const record = {
    id: "proposal-1",
    pluginId: "projects",
    entityId: "project-1",
    operation: "create" as const,
    payload: {
      kind: "project",
      title: "Example Project",
      slug: "example-project",
      description: "A project description",
      repository: "https://github.com/example/project",
    },
    schemaVersion: "1",
    createdBy: "alice.near",
    reviewStatus: "pending" as "pending" | "approved",
    applyStatus: "not_started" as "not_started" | "applied",
    removeStatus: "not_started" as const,
    rejectionReason: null,
    applyError: null,
    removeError: null,
    appliedResourceId: null as string | null,
    submissionCount: 1,
    appliedAt: null,
    removedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"api">>>;

  beforeAll(async () => {
    loaded = await runtime.usePlugin(
      "api",
      { variables: {}, secrets: { API_DATABASE_URL: "pglite::memory:" } },
      {
        activity: () => ({ emitTrustedActivity }),
        builders: () => ({}),
        events: () => ({}),
        nearcatalog: () => ({}),
        notifications: () => ({
          createNotification: async () => {
            operations.push("notification");
            return {};
          },
        }),
        projects: () => ({
          updateProject: async () => {
            operations.push("apply");
            return { id: "project-1", ownerId: "alice.near" };
          },
        }),
        proposals: () => ({
          approve: async () => {
            operations.push("approve");
            record.reviewStatus = "approved";
            return { data: record };
          },
          markApplied: async ({ appliedResourceId }: { appliedResourceId: string }) => {
            operations.push("markApplied");
            record.applyStatus = "applied";
            record.appliedResourceId = appliedResourceId;
            return { data: record };
          },
          markApplyFailed: vi.fn(),
        }),
        votes: () => ({}),
      } as never,
    );
  });

  afterAll(async () => {
    await runtime.shutdown();
  });

  it("emits once after resource application and before marking the proposal applied", async () => {
    const client = loaded.createClient({
      userId: "admin",
      near: testNear("admin.near"),
      user: testUser("admin", "admin"),
    });

    await client.approve({ pluginId: "projects", entityId: "project-1" });

    expect(operations).toEqual(["approve", "apply", "activity", "markApplied", "notification"]);
    expect(emitTrustedActivity).toHaveBeenCalledWith({
      source: "projects",
      type: "approved",
      actor: "alice.near",
      idempotencyKey: "proposal-approved:proposal-1:1",
      payload: {
        projectId: "project-1",
        projectKind: "project",
        projectSlug: "example-project",
        projectTitle: "Example Project",
        projectDescription: "A project description",
        repositoryUrl: "https://github.com/example/project",
      },
    });

    await client.approve({ pluginId: "projects", entityId: "project-1" });

    expect(emitTrustedActivity).toHaveBeenCalledTimes(1);
    expect(operations).toEqual([
      "approve",
      "apply",
      "activity",
      "markApplied",
      "notification",
      "approve",
    ]);
  });
});
