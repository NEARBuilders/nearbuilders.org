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

function makeRecord(entityId: string) {
  return {
    id: `proposal-${entityId}`,
    pluginId: "builders",
    entityId,
    operation: "create" as const,
    payload: {
      name: "New Builder",
      bio: "Building on NEAR",
      skills: ["rust"],
      location: "Remote",
    },
    schemaVersion: "1",
    createdBy: entityId,
    reviewStatus: "pending" as "pending" | "approved",
    applyStatus: "not_started" as "not_started" | "applying" | "applied",
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
}

describe("builder proposal approval avoids the throwing existence check", () => {
  const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
  // Intentionally no `getBuilder` mock: if the orchestration falls back to calling it,
  // the test blows up with "getBuilder is not a function" instead of silently passing.
  const listBuilders = vi.fn(async ({ search }: { search?: string }) => ({
    data: search === "existing.near" ? [{ nearAccount: "existing.near" }] : [],
    meta: { total: 0, hasMore: false, nextCursor: null },
  }));
  const createBuilder = vi.fn(async ({ nearAccount }: { nearAccount: string }) => ({
    data: { nearAccount },
  }));

  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"api">>>;
  const records = new Map<string, ReturnType<typeof makeRecord>>();

  beforeAll(async () => {
    loaded = await runtime.usePlugin(
      "api",
      { variables: {}, secrets: { API_DATABASE_URL: "pglite::memory:" } },
      {
        activity: () => ({ emitTrustedActivity: async () => ({}) }),
        builders: () => ({ listBuilders, createBuilder }),
        events: () => ({}),
        nearcatalog: () => ({}),
        notifications: () => ({ createNotification: async () => ({}) }),
        projects: () => ({}),
        proposals: () => ({
          approve: async ({ entityId }: { entityId: string }) => {
            const record = records.get(entityId)!;
            record.reviewStatus = "approved";
            record.applyStatus = "applying";
            return { data: record };
          },
          markApplied: async ({
            entityId,
            appliedResourceId,
          }: {
            entityId: string;
            appliedResourceId: string;
          }) => {
            const record = records.get(entityId)!;
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

  it("creates a new builder without calling the throwing getBuilder lookup", async () => {
    records.set("newbuilder.near", makeRecord("newbuilder.near"));
    const client = loaded.createClient({
      userId: "admin",
      near: testNear("admin.near"),
      user: testUser("admin", "admin"),
    });

    await client.approve({
      pluginId: "builders",
      entityId: "newbuilder.near",
      expectedUpdatedAt: timestamp,
    });

    expect(listBuilders).toHaveBeenCalledWith({ search: "newbuilder.near", limit: 1 });
    expect(createBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ nearAccount: "newbuilder.near" }),
    );
  });

  it("returns the existing builder without re-creating it", async () => {
    records.set("existing.near", makeRecord("existing.near"));
    createBuilder.mockClear();
    const client = loaded.createClient({
      userId: "admin",
      near: testNear("admin.near"),
      user: testUser("admin", "admin"),
    });

    await client.approve({
      pluginId: "builders",
      entityId: "existing.near",
      expectedUpdatedAt: timestamp,
    });

    expect(listBuilders).toHaveBeenCalledWith({ search: "existing.near", limit: 1 });
    expect(createBuilder).not.toHaveBeenCalled();
  });
});
