import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";

const entityId = "claim:alice.near:ref-finance";
const timestamp = "2026-07-13T00:00:00.000Z";

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

function pendingProposal() {
  return {
    id: "proposal-1",
    pluginId: "nearcatalog",
    entityId,
    operation: "create",
    payload: {
      nearAccount: "alice.near",
      projectSlug: "ref-finance",
      roles: ["Developer", "Reviewer"],
    },
    schemaVersion: "1",
    createdBy: "alice.near",
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
  };
}

describe("Catalog claim approval lifecycle", () => {
  const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
  let record: any = pendingProposal();
  const getBuilderMock = vi.fn(async () => ({ data: { nearAccount: "alice.near" } }));
  const applyClaimMock = vi.fn(async () => ({
    data: { id: "claim:alice.near:ref-finance", activityEventId: null },
  }));
  const setClaimActivityMock = vi.fn(async () => ({
    data: { id: "claim:alice.near:ref-finance", activityEventId: "activity-1" },
  }));
  const revokeClaimMock = vi.fn(async () => ({
    data: { id: "claim:alice.near:ref-finance", activityEventId: "activity-1" },
  }));
  const emitTrustedActivityMock = vi.fn(async () => ({
    id: "activity-1",
    source: "nearcatalog",
    type: "claim",
    actor: "alice.near",
    payload: {},
    verified: true,
    hiddenAt: null,
    createdAt: timestamp,
  }));
  const hideActivityMock = vi.fn(async () => ({ id: "activity-1" }));
  let version = 0;
  const advanceVersion = () => {
    version += 1;
    record.updatedAt = new Date(Date.parse(timestamp) + version).toISOString();
  };
  const markApplyFailedMock = vi.fn(async ({ error }: { error: string }) => {
    record.applyStatus = "failed";
    record.applyError = error;
    advanceVersion();
    return { data: record };
  });
  const removeMock = vi.fn(async () => {
    record.removeStatus = "removing";
    advanceVersion();
    return { data: record };
  });
  const markRemovedMock = vi.fn(async () => {
    record.reviewStatus = "removed";
    record.removeStatus = "removed";
    record.removeError = null;
    advanceVersion();
    return { data: record };
  });
  const markRemoveFailedMock = vi.fn(async ({ error }: { error: string }) => {
    record.removeStatus = "failed";
    record.removeError = error;
    advanceVersion();
    return { data: record };
  });
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"api">>>;

  beforeAll(async () => {
    loaded = await runtime.usePlugin(
      "api",
      { variables: {}, secrets: { API_DATABASE_URL: "pglite::memory:" } },
      {
        activity: () => ({
          emitTrustedActivity: emitTrustedActivityMock,
          hideActivity: hideActivityMock,
        }),
        builders: () => ({ getBuilder: getBuilderMock }),
        nearcatalog: () => ({
          getCatalogProject: async () => ({
            data: {
              slug: "ref-finance",
              projectRef: "nearcatalog:ref-finance",
              name: "Ref Finance",
              tagline: "DeFi on NEAR",
              description: null,
              imageUrl: "https://example.com/ref.png",
              repositoryUrl: "https://github.com/ref-finance/ref-ui",
              catalogUrl: "https://nearcatalog.xyz/project/ref-finance",
              tags: ["DeFi"],
              phase: "mainnet",
              status: "active",
            },
          }),
          applyCatalogClaim: applyClaimMock,
          setCatalogClaimActivity: setClaimActivityMock,
          revokeCatalogClaim: revokeClaimMock,
        }),
        notifications: () => ({ createNotification: vi.fn(async () => ({})) }),
        projects: () => ({}),
        proposals: () => ({
          approve: async () => {
            record.reviewStatus = "approved";
            record.applyStatus = "applying";
            advanceVersion();
            return { data: record };
          },
          reject: async ({ reason }: { reason?: string }) => {
            record.reviewStatus = "rejected";
            record.rejectionReason = reason ?? null;
            advanceVersion();
            return { data: record };
          },
          getProposals: async () => ({
            data: [record],
            meta: { total: 1, hasMore: false, nextCursor: null },
          }),
          markApplied: async ({ appliedResourceId }: { appliedResourceId: string }) => {
            record.applyStatus = "applied";
            record.appliedResourceId = appliedResourceId;
            advanceVersion();
            return { data: record };
          },
          markApplyFailed: markApplyFailedMock,
          remove: removeMock,
          markRemoved: markRemovedMock,
          markRemoveFailed: markRemoveFailedMock,
        }),
        votes: () => ({}),
      } as never,
    );
  });

  beforeEach(() => {
    record = pendingProposal();
    version = 0;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await runtime.shutdown();
  });

  function adminClient() {
    return loaded.createClient({
      userId: "admin",
      near: testNear("admin.near"),
      user: testUser("admin", "admin"),
    });
  }

  it("applies one verified claim event and hides it on revocation", async () => {
    await expect(
      loaded
        .createClient({
          userId: "member",
          near: testNear("member.near"),
          user: testUser("member", "member"),
        })
        .approve({ pluginId: "nearcatalog", entityId, expectedUpdatedAt: record.updatedAt }),
    ).rejects.toThrow("Requires role: admin");

    const approved = await adminClient().approve({
      pluginId: "nearcatalog",
      entityId,
      expectedUpdatedAt: record.updatedAt,
    });

    expect(approved.data.applyStatus).toBe("applied");
    expect(getBuilderMock).toHaveBeenCalledWith({ nearAccount: "alice.near" });
    expect(applyClaimMock).toHaveBeenCalledTimes(1);
    expect(emitTrustedActivityMock).toHaveBeenCalledTimes(1);
    expect(emitTrustedActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "nearcatalog",
        type: "claim",
        actor: "alice.near",
        idempotencyKey: `nearcatalog-claim:${entityId}:1`,
        payload: expect.objectContaining({
          claimId: "claim:alice.near:ref-finance",
          projectSlug: "ref-finance",
          catalogUrl: "https://nearcatalog.xyz/project/ref-finance",
          projectName: "Ref Finance",
          projectTagline: "DeFi on NEAR",
          projectImageUrl: "https://example.com/ref.png",
          repositoryUrl: "https://github.com/ref-finance/ref-ui",
          roles: ["Developer", "Reviewer"],
        }),
      }),
    );
    expect(setClaimActivityMock).toHaveBeenCalledWith({
      id: "claim:alice.near:ref-finance",
      activityEventId: "activity-1",
    });

    await adminClient().remove({
      pluginId: "nearcatalog",
      entityId,
      expectedUpdatedAt: record.updatedAt,
    });
    expect(revokeClaimMock).toHaveBeenCalledWith({ id: "claim:alice.near:ref-finance" });
    expect(hideActivityMock).toHaveBeenCalledWith({ id: "activity-1" });
    expect(record.removeStatus).toBe("removed");
  });

  it("rejects with a reason without creating a claim or activity", async () => {
    const rejected = await adminClient().reject({
      pluginId: "nearcatalog",
      entityId,
      expectedUpdatedAt: record.updatedAt,
      reason: "Clarify the selected roles",
    });

    expect(rejected.data).toMatchObject({
      reviewStatus: "rejected",
      rejectionReason: "Clarify the selected roles",
      applyStatus: "not_started",
    });
    expect(applyClaimMock).not.toHaveBeenCalled();
    expect(emitTrustedActivityMock).not.toHaveBeenCalled();
    expect(setClaimActivityMock).not.toHaveBeenCalled();
  });

  it("keeps approval active when revocation fails and permits a retry", async () => {
    await adminClient().approve({
      pluginId: "nearcatalog",
      entityId,
      expectedUpdatedAt: record.updatedAt,
    });
    revokeClaimMock.mockRejectedValueOnce(new Error("Could not revoke claim"));

    await expect(
      adminClient().remove({
        pluginId: "nearcatalog",
        entityId,
        expectedUpdatedAt: record.updatedAt,
      }),
    ).rejects.toThrow("Could not revoke claim");

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(markRemovedMock).not.toHaveBeenCalled();
    expect(markRemoveFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Could not revoke claim" }),
    );
    expect(record).toMatchObject({
      reviewStatus: "approved",
      removeStatus: "failed",
      removeError: "Could not revoke claim",
    });

    await adminClient().remove({
      pluginId: "nearcatalog",
      entityId,
      expectedUpdatedAt: record.updatedAt,
    });

    expect(removeMock).toHaveBeenCalledTimes(2);
    expect(markRemovedMock).toHaveBeenCalledTimes(1);
    expect(record).toMatchObject({
      reviewStatus: "removed",
      removeStatus: "removed",
      removeError: null,
    });
  });

  it("compensates a failed link and records apply failure", async () => {
    setClaimActivityMock.mockRejectedValueOnce(new Error("Could not link activity"));

    await expect(
      adminClient().approve({
        pluginId: "nearcatalog",
        entityId,
        expectedUpdatedAt: record.updatedAt,
      }),
    ).rejects.toThrow("Could not link activity");

    expect(hideActivityMock).toHaveBeenCalledWith({ id: "activity-1" });
    expect(revokeClaimMock).toHaveBeenCalledWith({ id: "claim:alice.near:ref-finance" });
    expect(markApplyFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Could not link activity" }),
    );
    expect(record.applyStatus).toBe("failed");
  });
});
