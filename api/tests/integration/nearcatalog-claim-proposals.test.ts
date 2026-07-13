import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";

type ProposalRecord = {
  id: string;
  pluginId: string;
  entityId: string;
  payload: unknown;
  createdBy: string;
  reviewStatus: "pending" | "approved" | "rejected" | "removed";
  removeStatus: "not_started" | "removed";
  rejectionReason: string | null;
  submissionCount: number;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const timestamp = "2026-07-11T00:00:00.000Z";

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

function contextNearAccount(context: Record<string, unknown>) {
  return (context.near as { primaryAccountId?: string } | undefined)?.primaryAccountId;
}

function proposal(
  account: string,
  slug: string,
  status: ProposalRecord["reviewStatus"] = "pending",
): ProposalRecord {
  return {
    id: `proposal:${account}:${slug}`,
    pluginId: "nearcatalog",
    entityId: `claim:${account}:${slug}`,
    payload: { nearAccount: account, projectSlug: slug, roles: ["Developer"] },
    createdBy: account,
    reviewStatus: status,
    removeStatus: status === "removed" ? "removed" : "not_started",
    rejectionReason: status === "rejected" ? "Add supporting context" : null,
    submissionCount: 1,
    removedAt: status === "removed" ? timestamp : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("Catalog claim proposal API", () => {
  const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
  const proposalRecords: ProposalRecord[] = [];
  const proposalKeys = new Map<string, ProposalRecord>();
  const proposeMock = vi.fn(
    async (context: Record<string, unknown>, input: Record<string, unknown>) => {
      const key = String(input.idempotencyKey);
      const retry = proposalKeys.get(key);
      if (retry) return { data: retry };
      const actor = String(contextNearAccount(context) ?? context.userId);
      const existing = proposalRecords.find(
        (record) => record.pluginId === input.pluginId && record.entityId === input.entityId,
      );
      const canResubmit =
        existing?.reviewStatus === "rejected" ||
        (context.resubmissionPolicy === "rejected-or-removed" &&
          (existing?.reviewStatus === "removed" || existing?.removeStatus === "removed"));
      if (existing && context.resubmissionPolicy && !canResubmit) {
        if (existing.reviewStatus === "removed" || existing.removeStatus === "removed") {
          throw new Error("Removed proposals cannot be resubmitted");
        }
        throw new Error(`This proposal is already ${existing.reviewStatus}`);
      }
      const now = new Date().toISOString();
      const record: ProposalRecord = existing ?? {
        ...proposal(actor, String((input.payload as { projectSlug: string }).projectSlug)),
        id: `proposal-${proposalRecords.length + 1}`,
        entityId: String(input.entityId),
        createdAt: now,
      };
      record.payload = input.payload;
      record.reviewStatus = "pending";
      record.removeStatus = "not_started";
      record.rejectionReason = null;
      record.submissionCount += existing ? 1 : 0;
      record.updatedAt = now;
      if (!existing) proposalRecords.push(record);
      proposalKeys.set(key, record);
      return { data: record };
    },
  );
  const getProposalsMock = vi.fn(
    async (context: Record<string, unknown>, input: Record<string, unknown>) => {
      const actor = String(contextNearAccount(context) ?? context.userId ?? "");
      const role = (context.user as { role?: string } | undefined)?.role;
      const data = proposalRecords.filter(
        (record) =>
          (!input.pluginId || record.pluginId === input.pluginId) &&
          (role === "admin" || record.pluginId !== "nearcatalog" || record.createdBy === actor),
      );
      return {
        data,
        meta: { total: data.length, hasMore: false, nextCursor: null },
      };
    },
  );
  const getCatalogProjectMock = vi.fn(async ({ slug }: { slug: string }) => ({
    data: {
      status: slug === "inactive-project" ? "inactive" : "active",
    },
  }));
  const applyCatalogClaimMock = vi.fn();
  const emitActivityMock = vi.fn();
  const getMyNotificationsMock = vi.fn(
    async (_context: Record<string, unknown>, _input: Record<string, unknown>) => ({
      data: [],
      meta: { total: 0, hasMore: false, nextCursor: null },
    }),
  );
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"api">>>;

  beforeAll(async () => {
    const plugins = {
      activity: () => ({ emitActivity: emitActivityMock }),
      builders: (context: Record<string, unknown> = {}) => ({
        getMyBuilderProfile: async () => {
          const account =
            context.userId === "approved-user"
              ? "Alice.NEAR"
              : context.userId === "bob-user"
                ? "bob.near"
                : null;
          return { data: account ? { nearAccount: account } : null };
        },
      }),
      nearcatalog: () => ({
        getCatalogProject: getCatalogProjectMock,
        applyCatalogClaim: applyCatalogClaimMock,
      }),
      notifications: (context: Record<string, unknown> = {}) => ({
        getMyNotifications: (input: Record<string, unknown>) =>
          getMyNotificationsMock(context, input),
      }),
      projects: () => ({}),
      proposals: (context: Record<string, unknown> = {}) => ({
        propose: (input: Record<string, unknown>) => proposeMock(context, input),
        getProposals: (input: Record<string, unknown>) => getProposalsMock(context, input),
      }),
    };

    loaded = await runtime.usePlugin(
      "api",
      {
        variables: {},
        secrets: { API_DATABASE_URL: "pglite::memory:" },
      },
      plugins as never,
    );
  });

  beforeEach(() => {
    proposalRecords.length = 0;
    proposalKeys.clear();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await runtime.shutdown();
  });

  function approvedClient() {
    return loaded.createClient({
      userId: "approved-user",
      near: testNear("alice.near"),
      user: testUser("approved-user", "member"),
    });
  }

  it("requires an approved authenticated builder and preserves linked wallet identity", async () => {
    await expect(
      loaded.createClient().submitCatalogClaimProposal({
        projectSlug: "ref-finance",
        roles: ["Developer"],
        idempotencyKey: "anonymous",
      }),
    ).rejects.toThrow("Authentication required");

    const unapproved = loaded.createClient({
      userId: "unapproved-user",
      near: testNear("unapproved.near"),
      user: testUser("unapproved-user", "member"),
    });
    await expect(
      unapproved.submitCatalogClaimProposal({
        projectSlug: "ref-finance",
        roles: ["Developer"],
        idempotencyKey: "unapproved",
      }),
    ).rejects.toThrow("An approved builder profile is required");
    expect(proposeMock).not.toHaveBeenCalled();

    const linkedClient = loaded.createClient({
      userId: "approved-user",
      near: testNear("alice.near"),
      user: testUser("approved-user", "member"),
    });
    await linkedClient.getMyNotifications({ limit: 5 });
    expect(getMyNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "alice.near",
        near: expect.objectContaining({ primaryAccountId: "alice.near" }),
      }),
      { limit: 5 },
    );

    const unlinkedClient = loaded.createClient({
      userId: "unlinked-user",
      user: testUser("unlinked-user", "member"),
    });
    await unlinkedClient.getMyNotifications({ limit: 1 });
    expect(getMyNotificationsMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: "unlinked-user" }),
      { limit: 1 },
    );
  });

  it("derives and validates submissions without creating claims or activity", async () => {
    const client = approvedClient();
    const result = await (client.submitCatalogClaimProposal as any)({
      projectSlug: "ref-finance",
      roles: [" Developer ", "developer", "Community", "community"],
      idempotencyKey: "submit-once",
      nearAccount: "mallory.near",
    });

    expect(result.data).toMatchObject({
      projectSlug: "ref-finance",
      roles: ["Developer", "Community"],
      status: "pending",
      submissionCount: 1,
    });
    expect(proposeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        near: expect.objectContaining({ primaryAccountId: "alice.near" }),
        resubmissionPolicy: "rejected-or-removed",
      }),
      expect.objectContaining({
        pluginId: "nearcatalog",
        entityId: "claim:alice.near:ref-finance",
        payload: {
          nearAccount: "alice.near",
          projectSlug: "ref-finance",
          roles: ["Developer", "Community"],
        },
        idempotencyKey: "submit-once",
      }),
    );
    expect(applyCatalogClaimMock).not.toHaveBeenCalled();
    expect(emitActivityMock).not.toHaveBeenCalled();

    await expect(
      client.submitCatalogClaimProposal({
        projectSlug: "inactive-project",
        roles: ["Developer"],
        idempotencyKey: "inactive",
      }),
    ).rejects.toThrow("Only active Catalog projects can be claimed");
    expect(proposeMock).toHaveBeenCalledTimes(1);

    await expect(
      client.propose({
        pluginId: "nearcatalog",
        entityId: "claim:mallory.near:ref-finance",
        payload: { nearAccount: "mallory.near" },
      }),
    ).rejects.toThrow("Use the Catalog claim proposal endpoint");
    expect(proposeMock).toHaveBeenCalledTimes(1);
  });

  it("keeps retries idempotent and only permits rejected proposal revisions", async () => {
    const client = approvedClient();
    const input = {
      projectSlug: "ref-finance",
      roles: ["Developer"],
      idempotencyKey: "initial-submission",
    };

    const first = await client.submitCatalogClaimProposal(input);
    const retry = await client.submitCatalogClaimProposal(input);

    expect(retry.data.id).toBe(first.data.id);
    expect(retry.data.submissionCount).toBe(1);
    await expect(
      client.submitCatalogClaimProposal({
        ...input,
        roles: ["Content"],
        idempotencyKey: "pending-revision",
      }),
    ).rejects.toThrow("This proposal is already pending");

    const record = proposalRecords[0]!;
    record.reviewStatus = "rejected";
    record.rejectionReason = "Clarify the role";
    const revised = await client.submitCatalogClaimProposal({
      ...input,
      roles: ["Developer", "Content"],
      idempotencyKey: "rejected-revision",
    });

    expect(revised.data).toMatchObject({
      id: first.data.id,
      roles: ["Developer", "Content"],
      status: "pending",
      submissionCount: 2,
    });

    record.reviewStatus = "approved";
    await expect(
      client.submitCatalogClaimProposal({ ...input, idempotencyKey: "approved-revision" }),
    ).rejects.toThrow("This proposal is already approved");

    record.reviewStatus = "removed";
    record.removeStatus = "removed";
    const restored = await client.submitCatalogClaimProposal({
      ...input,
      roles: ["Maintainer"],
      idempotencyKey: "removed-revision",
    });
    expect(restored.data).toMatchObject({
      status: "pending",
      roles: ["Maintainer"],
      submissionCount: 3,
    });
  });

  it("returns only the caller's normalized proposal statuses", async () => {
    const pending = proposal("alice.near", "pending-project", "pending");
    const rejected = proposal("alice.near", "rejected-project", "rejected");
    const approved = proposal("alice.near", "approved-project", "approved");
    const revoked = proposal("alice.near", "revoked-project", "removed");
    const unrelated = proposal("bob.near", "bob-project", "pending");
    rejected.submissionCount = 2;
    proposalRecords.push(pending, rejected, approved, revoked, unrelated);

    const result = await approvedClient().getMyCatalogClaimProposals();

    expect(result.data.map((item) => item.status)).toEqual([
      "pending",
      "rejected",
      "approved",
      "revoked",
    ]);
    expect(result.data.map((item) => item.projectSlug)).not.toContain("bob-project");
    expect(result.data[1]).toMatchObject({
      rejectionReason: "Add supporting context",
      submissionCount: 2,
    });
    expect(Object.keys(result.data[0]!).sort()).toEqual(
      [
        "createdAt",
        "id",
        "projectSlug",
        "rejectionReason",
        "revokedAt",
        "roles",
        "status",
        "submissionCount",
        "updatedAt",
      ].sort(),
    );
  });
});
