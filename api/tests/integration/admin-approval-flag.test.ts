import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";
import { AUTO_APPROVAL_ACTOR_ID } from "../../src/services/approval-settings";

type ProposalRecord = {
  id: string;
  pluginId: string;
  entityId: string;
  operation: "create";
  payload: Record<string, unknown>;
  schemaVersion: string;
  createdBy: string;
  reviewStatus: "pending" | "approved" | "rejected" | "removed";
  applyStatus: "not_started" | "applying" | "applied" | "failed";
  removeStatus: "not_started" | "removing" | "removed" | "failed";
  rejectionReason: string | null;
  applyError: string | null;
  removeError: string | null;
  appliedResourceId: string | null;
  submissionCount: number;
  appliedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CapturedContext = {
  userId?: string;
  user?: { id?: string; role?: string };
  near?: { primaryAccountId?: string };
  allowPublicVisibility?: boolean;
};

const timestamp = "2026-10-22T00:00:00.000Z";

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
    },
    near: { primaryAccountId: nearAccount, linkedAccounts: [], hasNearAccount: true },
  };
}

function pendingRecord(input: Record<string, unknown>, previous?: ProposalRecord): ProposalRecord {
  return {
    id: previous?.id ?? `proposal-${String(input.entityId)}`,
    pluginId: String(input.pluginId),
    entityId: String(input.entityId),
    operation: "create",
    payload: input.payload as Record<string, unknown>,
    schemaVersion: "1",
    createdBy: previous?.createdBy ?? String(input.entityId),
    reviewStatus: "pending",
    applyStatus: "not_started",
    removeStatus: "not_started",
    rejectionReason: null,
    applyError: null,
    removeError: null,
    appliedResourceId: null,
    submissionCount: (previous?.submissionCount ?? 0) + 1,
    appliedAt: null,
    removedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function projectRecord(input: Record<string, unknown>) {
  return {
    id: String(input.id ?? "project-1"),
    ownerId: "alice-user",
    organizationId: "org-1",
    kind: String(input.kind ?? "project"),
    title: String(input.title ?? "Alpha"),
    slug: String(input.slug ?? "alpha-abc123"),
    description: "",
    content: "",
    status: "active",
    visibility: input.visibility,
    repository: "",
    domain: "",
    logoUrl: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const profileInput = {
  name: "Alice",
  bio: "Builds useful things.",
  skills: ["TypeScript"],
};

describe("REQUIRE_ADMIN_APPROVAL flag", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadApi(options: {
    requireAdminApproval?: string;
    previous?: ProposalRecord;
    failApply?: boolean;
  }) {
    const records = new Map<string, ProposalRecord>();
    if (options.previous) records.set(options.previous.entityId, options.previous);
    const approveContexts: CapturedContext[] = [];
    const projectContexts: CapturedContext[] = [];
    const approve = vi.fn(async ({ entityId }: { entityId: string }) => {
      const record = records.get(entityId)!;
      record.reviewStatus = "approved";
      record.applyStatus = "applying";
      return { data: { ...record } };
    });
    const markApplied = vi.fn(
      async ({ entityId, appliedResourceId }: { entityId: string; appliedResourceId: string }) => {
        const record = records.get(entityId)!;
        record.applyStatus = "applied";
        record.appliedResourceId = appliedResourceId;
        return { data: { ...record } };
      },
    );
    const markApplyFailed = vi.fn(async ({ entityId }: { entityId: string }) => {
      const record = records.get(entityId)!;
      record.applyStatus = "failed";
      return { data: { ...record } };
    });
    const createBuilder = vi.fn(async ({ nearAccount }: { nearAccount: string }) => {
      if (options.failApply) throw new Error("builders unavailable");
      return { data: { nearAccount } };
    });
    const emitTrustedActivity = vi.fn(async () => ({}));
    const createNotification = vi.fn(async () => ({}));
    const createProject = vi.fn(async (input: Record<string, unknown>) => ({
      ...projectRecord(input),
      collaborators: [],
    }));
    const updateProject = vi.fn(async (input: Record<string, unknown>) => projectRecord(input));

    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    const secrets: Record<string, string> = { API_DATABASE_URL: "pglite::memory:" };
    if (options.requireAdminApproval !== undefined) {
      secrets.REQUIRE_ADMIN_APPROVAL = options.requireAdminApproval;
    }
    const loaded = await runtime.usePlugin("api", { variables: {}, secrets }, {
      activity: () => ({ emitTrustedActivity }),
      builders: () => ({
        getMyBuilderProfile: async () => ({ data: null }),
        listBuilders: async () => ({
          data: [],
          meta: { total: 0, hasMore: false, nextCursor: null },
        }),
        createBuilder,
      }),
      events: () => ({}),
      nearcatalog: () => ({}),
      notifications: () => ({ createNotification }),
      projects: (context: CapturedContext) => {
        projectContexts.push(context);
        return { createProject, updateProject };
      },
      proposals: (context: CapturedContext) => ({
        getProposals: async ({ entityId }: { entityId: string }) => {
          const record = records.get(entityId);
          return {
            data: record ? [{ ...record }] : [],
            meta: { total: record ? 1 : 0, hasMore: false, nextCursor: null },
          };
        },
        propose: async (input: Record<string, unknown>) => {
          const record = pendingRecord(input, records.get(String(input.entityId)));
          records.set(record.entityId, record);
          return { data: { ...record } };
        },
        approve: async (input: { entityId: string }) => {
          approveContexts.push(context);
          return approve(input);
        },
        markApplied,
        markApplyFailed,
      }),
      votes: () => ({}),
    } as never);

    return {
      loaded,
      records,
      approve,
      approveContexts,
      createBuilder,
      createNotification,
      createProject,
      emitTrustedActivity,
      markApplyFailed,
      projectContexts,
      updateProject,
    };
  }

  it("is off by default and reports it through the public settings route", async () => {
    const { loaded } = await loadApi({});
    await expect(loaded.createClient().getApprovalSettings()).resolves.toEqual({
      requireAdminApproval: false,
    });
  });

  it("reports approval as required when the flag is on", async () => {
    const { loaded } = await loadApi({ requireAdminApproval: "true" });
    await expect(loaded.createClient().getApprovalSettings()).resolves.toEqual({
      requireAdminApproval: true,
    });
  });

  it("publishes a builder profile immediately through the approval pipeline when off", async () => {
    const api = await loadApi({});
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    const result = await client.submitBuilderProfile(profileInput);

    expect(result.data).toMatchObject({
      entityId: "alice.near",
      reviewStatus: "approved",
      applyStatus: "applied",
      appliedResourceId: "alice.near",
    });
    expect(api.approve).toHaveBeenCalledWith({
      pluginId: "builders",
      entityId: "alice.near",
      expectedUpdatedAt: timestamp,
    });
    expect(api.approveContexts[0]).toMatchObject({
      userId: AUTO_APPROVAL_ACTOR_ID,
      user: { id: AUTO_APPROVAL_ACTOR_ID, role: "admin" },
    });
    expect(api.approveContexts[0]?.near).toBeUndefined();
    expect(api.createBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ nearAccount: "alice.near", userId: "alice-user", name: "Alice" }),
    );
    expect(api.emitTrustedActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "approved", actor: "alice.near" }),
    );
    expect(api.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "alice.near", type: "builder_approved" }),
    );
  });

  it.each([
    "true",
    "1",
    "on",
  ])("keeps builder profiles pending when the flag is %s", async (value) => {
    const api = await loadApi({ requireAdminApproval: value });
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    const result = await client.submitBuilderProfile(profileInput);

    expect(result.data).toMatchObject({ reviewStatus: "pending", applyStatus: "not_started" });
    expect(api.approve).not.toHaveBeenCalled();
    expect(api.createBuilder).not.toHaveBeenCalled();
  });

  it.each([
    "rejected",
    "removed",
  ] as const)("sends a previously %s profile back to admin review when off", async (reviewStatus) => {
    const previous = {
      ...pendingRecord({ pluginId: "builders", entityId: "alice.near", payload: {} }),
      reviewStatus,
      removeStatus: reviewStatus === "removed" ? ("removed" as const) : ("not_started" as const),
    };
    const api = await loadApi({ previous });
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    const result = await client.submitBuilderProfile(profileInput);

    expect(result.data).toMatchObject({ reviewStatus: "pending", submissionCount: 2 });
    expect(api.approve).not.toHaveBeenCalled();
  });

  it("still blocks a second submission while an older proposal is pending", async () => {
    const previous = pendingRecord({ pluginId: "builders", entityId: "alice.near", payload: {} });
    const api = await loadApi({ previous });
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    await expect(client.submitBuilderProfile(profileInput)).rejects.toThrow(
      "already pending review",
    );
    expect(api.approve).not.toHaveBeenCalled();
  });

  it("leaves the proposal for admins when auto-approval fails", async () => {
    const api = await loadApi({ failApply: true });
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await client.submitBuilderProfile(profileInput);

    expect(result.data).toMatchObject({
      entityId: "alice.near",
      reviewStatus: "approved",
      applyStatus: "failed",
    });
    expect(api.markApplyFailed).toHaveBeenCalled();
    expect(api.records.get("alice.near")).toMatchObject({
      reviewStatus: "approved",
      applyStatus: "failed",
    });
    errors.mockRestore();
  });

  it("creates public projects for members when off", async () => {
    const api = await loadApi({});
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    await client.createProject({
      kind: "project",
      title: "Alpha",
      slug: "alpha-abc123",
      visibility: "public",
    });

    expect(api.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "public" }),
    );
  });

  it("keeps member projects private until review when on", async () => {
    const api = await loadApi({ requireAdminApproval: "true" });
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    await client.createProject({
      kind: "project",
      title: "Alpha",
      slug: "alpha-abc123",
      visibility: "public",
    });

    expect(api.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: "private" }),
    );
  });

  it.each([
    [undefined, true],
    ["true", false],
  ] as const)("passes allowPublicVisibility to project updates (flag %s)", async (flag, allowed) => {
    const api = await loadApi({ requireAdminApproval: flag });
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    await client.updateProject({ id: "project-1", visibility: "public" });

    expect(api.updateProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project-1", visibility: "public" }),
    );
    expect(api.projectContexts.at(-1)?.allowPublicVisibility).toBe(allowed);
  });

  it.each([
    ["rejected", "not_started"],
    ["removed", "removed"],
  ] as const)("keeps an admin-%s project behind review when off", async (reviewStatus, removeStatus) => {
    const previous = pendingRecord({ pluginId: "projects", entityId: "project-1" });
    previous.reviewStatus = reviewStatus;
    previous.removeStatus = removeStatus;
    const api = await loadApi({ previous });
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    await client.updateProject({ id: "project-1", visibility: "public" });

    expect(api.projectContexts.at(-1)?.allowPublicVisibility).toBe(false);
  });

  it("does not grant public visibility for updates that do not publish", async () => {
    const api = await loadApi({});
    const client = api.loaded.createClient(memberContext("alice-user", "alice.near") as never);

    await client.updateProject({ id: "project-1", title: "Renamed", visibility: "private" });

    expect(api.projectContexts.at(-1)?.allowPublicVisibility).toBe(false);
  });
});
