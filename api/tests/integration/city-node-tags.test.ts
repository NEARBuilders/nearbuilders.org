import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";
import { asPluginEntries } from "../helpers/plugin-entries";

const timestamp = "2026-10-26T00:00:00.000Z";

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

const nodeSummaries = [
  {
    node: {
      id: "node-1",
      kind: "city",
      slug: "lakeside",
      name: "Lakeside",
      parentId: null,
      tenantId: null,
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    childrenCount: 0,
    validatorCount: 0,
  },
  {
    node: {
      id: "node-2",
      kind: "city",
      slug: "harbor",
      name: "Harbor",
      parentId: "node-1",
      tenantId: null,
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    childrenCount: 0,
    validatorCount: 0,
  },
];

function projectRecord(input: Record<string, unknown>, cityNode: string | null = null) {
  return {
    id: String(input.id ?? "project-1"),
    ownerId: "alice.near",
    organizationId: null,
    kind: "idea",
    title: "Alpha",
    slug: "alpha",
    description: null,
    content: null,
    status: "active",
    visibility: "public",
    repository: null,
    domain: null,
    logoUrl: null,
    cityNode: input.cityNode === undefined ? cityNode : input.cityNode,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("city node tags", () => {
  const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ json: nodeSummaries }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const proposals: Array<Record<string, unknown>> = [];
  const createProject = vi.fn(async (input: Record<string, unknown>) => ({
    ...projectRecord(input),
    collaborators: [],
  }));
  const updateProject = vi.fn(async (input: Record<string, unknown>) => projectRecord(input));
  const getProject = vi.fn();
  const getBuilder = vi.fn();
  const updateBuilderProfile = vi.fn(async (input: Record<string, unknown>) => ({
    data: {
      id: "builder-1",
      nearAccount: String(input.nearAccount),
      userId: "alice-user",
      name: "Alice",
      bio: null,
      skills: [],
      location: null,
      links: null,
      cityNode: input.cityNode ?? null,
      catalog: null,
      withdrawnAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }));
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"api">>>;

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    loaded = await runtime.usePlugin(
      "api",
      {
        variables: { reviewEvaluationEnabled: false, cityNodeUrl: "https://citynode.test" },
        secrets: { API_DATABASE_URL: "pglite::memory:", REQUIRE_ADMIN_APPROVAL: "true" },
      },
      asPluginEntries({
        activity: () => ({}),
        builders: () => ({
          getMyBuilderProfile: async () => ({ data: null }),
          getBuilder,
          updateBuilderProfile,
        }),
        events: () => ({}),
        nearcatalog: () => ({}),
        notifications: () => ({}),
        projects: () => ({
          createProject,
          updateProject,
          getProject,
        }),
        proposals: () => ({
          getProposals: async () => ({
            data: [],
            meta: { total: 0, hasMore: false, nextCursor: null },
          }),
          propose: async (input: Record<string, unknown>) => {
            proposals.push(input);
            return {
              data: {
                id: "proposal-1",
                pluginId: input.pluginId,
                entityId: input.entityId,
                operation: "create",
                payload: input.payload,
                schemaVersion: "1",
                createdBy: input.entityId,
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
  });

  afterAll(async () => {
    await runtime.shutdown();
    vi.unstubAllGlobals();
  });

  const member = () =>
    loaded.createClient(memberContext("alice-user", "alice.near") as never) as any;

  it("serves the cached citynode.app list", async () => {
    const result = await loaded.createClient().listCityNodes();
    expect(result.data).toEqual([
      {
        key: "lakeside",
        slug: "lakeside",
        name: "Lakeside",
        kind: "city",
        parentKey: null,
        parentId: null,
        depth: 0,
      },
      {
        key: "lakeside/harbor",
        slug: "harbor",
        name: "Harbor",
        kind: "city",
        parentKey: "lakeside",
        parentId: "node-1",
        depth: 1,
      },
    ]);
    expect(result.meta).toMatchObject({ baseUrl: "https://citynode.test", available: true });
    const [request] = fetchMock.mock.calls[0] as unknown as [Request | string];
    expect(typeof request === "string" ? request : request.url).toBe(
      "https://citynode.test/api/rpc/listNodeSummaries",
    );
  });

  it("carries a known city node into the builder proposal", async () => {
    await member().submitBuilderProfile({
      name: "Alice",
      bio: "Builds useful things.",
      skills: ["TypeScript"],
      cityNode: "Lakeside",
    });
    expect(proposals.at(-1)?.payload).toMatchObject({ cityNode: "lakeside" });
  });

  it("rejects unknown city nodes on builders and projects", async () => {
    await expect(
      member().submitBuilderProfile({
        name: "Alice",
        bio: "Builds useful things.",
        skills: ["TypeScript"],
        cityNode: "atlantis",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Unknown city node: atlantis" });
    await expect(
      member().createProject({ kind: "idea", title: "Alpha", slug: "alpha", cityNode: "atlantis" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member().updateBuilderProfile({ nearAccount: "alice.near", cityNode: "atlantis" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createProject).not.toHaveBeenCalled();
    expect(updateBuilderProfile).not.toHaveBeenCalled();
  });

  it("accepts known and nested nodes and clears without reading the current tag", async () => {
    const created = await member().createProject({
      kind: "idea",
      title: "Alpha",
      slug: "alpha",
      cityNode: "lakeside",
    });
    expect(created.cityNode).toBe("lakeside");

    await expect(
      member().updateProject({ id: "project-1", cityNode: "lakeside/harbor" }),
    ).resolves.toMatchObject({ cityNode: "lakeside/harbor" });
    await expect(
      member().updateProject({ id: "project-1", cityNode: "harbor" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member().updateProject({ id: "project-1", cityNode: null }),
    ).resolves.toMatchObject({ cityNode: null });
    await expect(
      member().updateBuilderProfile({ nearAccount: "alice.near", cityNode: "lakeside/harbor" }),
    ).resolves.toMatchObject({ data: { cityNode: "lakeside/harbor" } });
    expect(getProject).not.toHaveBeenCalled();
    expect(getBuilder).not.toHaveBeenCalled();
  });
});
