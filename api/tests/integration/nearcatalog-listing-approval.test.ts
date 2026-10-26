import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createPluginRuntime } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG_LISTING_SYNC } from "../../../plugins/nearcatalog/src/contract";
import { createDatabaseDriver } from "../../../plugins/nearcatalog/src/db";
import { createListingMethods } from "../../../plugins/nearcatalog/src/services/listings";
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

type TestContext = {
  userId?: string;
  user?: { id?: string; role?: string };
  near?: { primaryAccountId?: string };
  [CATALOG_LISTING_SYNC]?: true;
};

const timestamp = "2026-10-26T00:00:00.000Z";
const migration = join(
  import.meta.dirname,
  "../../../plugins/nearcatalog/src/db/migrations/0002_catalog_listings.sql",
);

function userContext(userId: string, nearAccount: string | null, role = "member") {
  return {
    userId,
    user: {
      id: userId,
      name: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      role,
      isAnonymous: false,
    },
    near: nearAccount
      ? { primaryAccountId: nearAccount, linkedAccounts: [], hasNearAccount: true }
      : undefined,
  };
}

const owner = () => userContext("owner-user", "maker.testnet");
const admin = () => userContext("admin-user", "reviewer.testnet", "admin");
const autoApproval = () => userContext(AUTO_APPROVAL_ACTOR_ID, null, "admin");

function catalogProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    ownerId: "maker.testnet",
    organizationId: null,
    kind: "project",
    title: "Lantern Pay",
    slug: "lantern-pay-x1",
    description: "Lantern Pay lets small shops take NEAR payments.",
    content: "",
    status: "active",
    visibility: "public",
    repository: "https://github.com/example/lantern-pay",
    domain: "lantern.example.com",
    logoUrl: "https://lantern.example.com/logo.png",
    catalog: {
      tagline: "Payments for small shops",
      categories: ["payment"],
      phase: "testnet",
      links: { twitter: "https://x.com/lanternpay" },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    apps: [],
    ...overrides,
  };
}

function catalogBuilder(overrides: Record<string, unknown> = {}) {
  return {
    id: "builder-1",
    nearAccount: "maker.testnet",
    userId: "owner-user",
    name: "Robin Maker",
    bio: "Builds payment tools on NEAR.",
    skills: ["TypeScript"],
    location: null,
    links: { telegram: "https://t.me/robinmaker" },
    catalog: {
      preferredContact: "Telegram",
      organization: "Lantern",
      avatarUrl: "https://lantern.example.com/robin.png",
    },
    withdrawnAt: null as string | null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

async function runListing<A>(effect: Effect.Effect<A, unknown>) {
  return await Effect.runPromise(effect as Effect.Effect<A, never>);
}

describe("NEAR Catalog listing approval", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  async function loadApi(options: { requireAdminApproval?: string } = {}) {
    const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-catalog-listing-"));
    const driver = await createDatabaseDriver(`pglite:${dataDir}`);
    for (const statement of (await readFile(migration, "utf8")).split("--> statement-breakpoint")) {
      await driver.db.execute(sql.raw(statement));
    }
    const listingMethods = createListingMethods(driver.db);
    const syncFlags: boolean[] = [];

    const projects = new Map<string, ReturnType<typeof catalogProject>>();
    projects.set("project-1", catalogProject());
    const builders = new Map<string, ReturnType<typeof catalogBuilder>>();
    builders.set("maker.testnet", catalogBuilder());
    const records = new Map<string, ProposalRecord>();
    const proposeContexts: TestContext[] = [];
    const approveContexts: TestContext[] = [];

    const propose = vi.fn(async (context: TestContext, input: Record<string, unknown>) => {
      proposeContexts.push(context);
      const previous = records.get(String(input.entityId));
      const record: ProposalRecord = {
        id: previous?.id ?? `proposal-${String(input.entityId)}`,
        pluginId: String(input.pluginId),
        entityId: String(input.entityId),
        operation: "create",
        payload: input.payload as Record<string, unknown>,
        schemaVersion: "1",
        createdBy: previous?.createdBy ?? String(context.near?.primaryAccountId),
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
        updatedAt: new Date(Date.parse(timestamp) + records.size * 1000 + 1).toISOString(),
      };
      records.set(record.entityId, record);
      return { data: { ...record } };
    });
    const createNotification = vi.fn(async () => ({}));

    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    const secrets: Record<string, string> = { API_DATABASE_URL: "pglite::memory:" };
    if (options.requireAdminApproval !== undefined) {
      secrets.REQUIRE_ADMIN_APPROVAL = options.requireAdminApproval;
    }
    const loaded = await runtime.usePlugin("api", { variables: {}, secrets }, {
      activity: () => ({ emitTrustedActivity: async () => ({}) }),
      builders: () => ({
        getMyBuilderProfile: async () => ({ data: builders.get("maker.testnet") ?? null }),
        getBuilder: async ({ nearAccount }: { nearAccount: string }) => {
          const builder = builders.get(nearAccount);
          if (!builder) throw Object.assign(new Error("Builder not found"), { code: "NOT_FOUND" });
          return { data: builder };
        },
        updateBuilderProfile: async (input: Record<string, unknown>) => {
          const next = { ...builders.get("maker.testnet")!, ...input };
          builders.set("maker.testnet", next as ReturnType<typeof catalogBuilder>);
          return { data: next };
        },
        withdrawMyBuilderProfile: async () => {
          const next = { ...builders.get("maker.testnet")!, withdrawnAt: timestamp };
          builders.set("maker.testnet", next);
          return { data: next };
        },
      }),
      events: () => ({}),
      nearcatalog: (context: TestContext = {}) => {
        const sync = context[CATALOG_LISTING_SYNC] === true;
        const track = <A>(effect: Effect.Effect<A, unknown>) => {
          syncFlags.push(sync);
          return runListing(effect);
        };
        return {
          listCatalogCategories: async () => ({ data: [{ id: "payment", label: "Payment" }] }),
          getCatalogListing: async (input: { kind: "project" | "person"; entityId: string }) => ({
            data: await track(listingMethods.getListing(input)),
          }),
          markCatalogListingPending: async (input: never) => ({
            data: await track(listingMethods.markPending(input)),
          }),
          approveCatalogListing: async (input: never) => ({
            data: await track(listingMethods.approve(input)),
          }),
          rejectCatalogListing: async (input: never) => ({
            data: await track(listingMethods.reject(input)),
          }),
          withdrawCatalogListing: async (input: never) => ({
            data: await track(listingMethods.withdraw(input)),
          }),
          refreshCatalogListingRecord: async (input: never) => ({
            data: await track(listingMethods.refreshRecord(input)),
          }),
        };
      },
      notifications: () => ({ createNotification }),
      projects: () => ({
        getProject: async ({ id }: { id: string }) => {
          const project = projects.get(id);
          if (!project) throw Object.assign(new Error("Project not found"), { code: "NOT_FOUND" });
          return { data: project };
        },
        updateProject: async (input: Record<string, unknown>) => {
          const next = { ...projects.get(String(input.id))!, ...input };
          projects.set(String(input.id), next as ReturnType<typeof catalogProject>);
          return next;
        },
        deleteProject: async ({ id }: { id: string }) => {
          projects.delete(id);
          return { deleted: true };
        },
      }),
      proposals: (context: TestContext = {}) => ({
        getProposals: async ({ entityId }: { entityId?: string }) => {
          const record = entityId ? records.get(entityId) : undefined;
          return {
            data: record ? [{ ...record }] : [],
            meta: { total: record ? 1 : 0, hasMore: false, nextCursor: null },
          };
        },
        propose: (input: Record<string, unknown>) => propose(context, input),
        approve: async ({ entityId }: { entityId: string }) => {
          approveContexts.push(context);
          const record = records.get(entityId)!;
          record.reviewStatus = "approved";
          record.applyStatus = "applying";
          return { data: { ...record } };
        },
        markApplied: async ({ entityId, appliedResourceId }: Record<string, string>) => {
          const record = records.get(entityId!)!;
          record.applyStatus = "applied";
          record.appliedResourceId = appliedResourceId ?? null;
          return { data: { ...record } };
        },
        markApplyFailed: async ({ entityId, error }: Record<string, string>) => {
          const record = records.get(entityId!)!;
          record.applyStatus = "failed";
          record.applyError = error ?? null;
          return { data: { ...record } };
        },
        reject: async ({ entityId, reason }: { entityId: string; reason?: string }) => {
          const record = records.get(entityId)!;
          record.reviewStatus = "rejected";
          record.rejectionReason = reason ?? null;
          return { data: { ...record } };
        },
        withdraw: async ({ entityId }: { entityId: string }) => {
          const record = records.get(entityId)!;
          record.reviewStatus = "removed";
          return { data: { ...record } };
        },
      }),
      votes: () => ({}),
    } as never);

    cleanups.push(async () => {
      await runtime.shutdown();
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    });

    const listing = (kind: "project" | "person", entityId: string) =>
      runListing(listingMethods.getListing({ kind, entityId }));

    return {
      client: (context: unknown) => loaded.createClient(context as never),
      approveContexts,
      builders,
      createNotification,
      listing,
      projects,
      propose,
      proposeContexts,
      records,
      syncFlags,
    };
  }

  async function approveProject(api: Awaited<ReturnType<typeof loadApi>>, context = admin()) {
    const proposal = api.records.get("project:project-1")!;
    return await api.client(context).approve({
      pluginId: "nearcatalog-listing",
      entityId: "project:project-1",
      expectedUpdatedAt: proposal.updatedAt,
    });
  }

  it.each([
    ["off", undefined],
    ["on", "true"],
  ])("keeps a project submission pending until an admin decides (flag %s)", async (_label, flag) => {
    const api = await loadApi({ requireAdminApproval: flag });

    const result = await api.client(owner()).submitCatalogListing({
      kind: "project",
      projectId: "project-1",
    });

    expect(result.data.status).toBe("pending");
    expect(result.data.listed).toBe(false);
    expect(api.records.get("project:project-1")?.reviewStatus).toBe("pending");
    expect(api.approveContexts).toHaveLength(0);
    expect(api.proposeContexts[0]?.near?.primaryAccountId).toBe("maker.testnet");
    expect((await api.listing("project", "project-1"))?.status).toBe("pending");
    expect(api.syncFlags.every(Boolean)).toBe(true);
  });

  it("puts the exact export record in the proposal for the admin to review", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

    const payload = api.records.get("project:project-1")?.payload;
    expect(payload).toMatchObject({ kind: "project", entityId: "project-1", slug: "lantern-pay" });
    expect(payload?.record).toEqual({
      slug: "lantern-pay",
      title: "Lantern Pay",
      oneliner: "Payments for small shops",
      description: "Lantern Pay lets small shops take NEAR payments.",
      logo: "https://lantern.example.com/logo.png",
      categories: ["payment"],
      website: "https://lantern.example.com/",
      twitter: "https://x.com/lanternpay",
      medium: "",
      telegram: "",
      github: "https://github.com/example/lantern-pay",
      discord: "",
      whitepaper: "",
      "token-address": "",
      "coingecko-address": "",
      "nearsocial-address": "",
      dapp: "https://lantern.example.com/",
      phase: "testnet",
      source: {
        site: "nearbuilders.org",
        url: "https://nearbuilders.org/projects/project/lantern-pay-x1",
        nearAccount: "maker.testnet",
        updatedAt: timestamp,
      },
    });
  });

  it("blocks submission until the required catalog fields are filled in", async () => {
    const api = await loadApi();
    api.projects.set("project-1", catalogProject({ logoUrl: "", catalog: { categories: [] } }));

    await expect(
      api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" }),
    ).rejects.toThrow(/One-line tagline, Logo, At least one category/);
    expect(api.propose).not.toHaveBeenCalled();
  });

  it.each([
    ["private", { visibility: "private" }],
    ["an idea", { kind: "idea" }],
  ])("refuses to submit a project that is %s", async (_label, overrides) => {
    const api = await loadApi();
    api.projects.set("project-1", catalogProject(overrides));

    await expect(
      api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" }),
    ).rejects.toThrow();
    expect(api.propose).not.toHaveBeenCalled();
  });

  it("only lets the project owner submit it", async () => {
    const api = await loadApi();
    await expect(
      api.client(userContext("other-user", "someone.testnet")).submitCatalogListing({
        kind: "project",
        projectId: "project-1",
      }),
    ).rejects.toThrow(/owner/);
  });

  it("never lets the auto-approval actor approve a catalog listing", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

    await expect(approveProject(api, autoApproval())).rejects.toThrow(/human admin/);
    expect(api.approveContexts).toHaveLength(0);
    expect((await api.listing("project", "project-1"))?.status).toBe("pending");
  });

  it("stores the approved record and the admin who approved it", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

    const approved = await approveProject(api);

    expect(approved.data.applyStatus).toBe("applied");
    expect(api.approveContexts[0]?.userId).toBe("admin-user");
    const listing = await api.listing("project", "project-1");
    expect(listing).toMatchObject({
      status: "approved",
      slug: "lantern-pay",
      approvedBy: "reviewer.testnet",
    });
    expect(listing?.record).toEqual(api.records.get("project:project-1")?.payload.record);
    expect(api.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "maker.testnet",
        type: "nearcatalog_listing_approved",
        link: "/projects/project/lantern-pay-x1",
      }),
    );
  });

  it("sends the owner the rejection reason", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
    const proposal = api.records.get("project:project-1")!;

    await api.client(admin()).reject({
      pluginId: "nearcatalog-listing",
      entityId: "project:project-1",
      expectedUpdatedAt: proposal.updatedAt,
      reason: "Logo is a placeholder",
    });

    expect((await api.listing("project", "project-1"))?.status).toBe("rejected");
    expect(api.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "maker.testnet",
        type: "nearcatalog_listing_rejected",
        body: expect.stringContaining("Reason: Logo is a placeholder"),
      }),
    );
    const status = await api.client(owner()).getMyCatalogListing({
      kind: "project",
      projectId: "project-1",
    });
    expect(status.data).toMatchObject({
      status: "rejected",
      rejectionReason: "Logo is a placeholder",
    });
  });

  it("sends big edits after approval back to review and keeps small edits", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
    await approveProject(api);
    const approvedRecord = (await api.listing("project", "project-1"))?.record;

    await api.client(owner()).updateProject({
      id: "project-1",
      description: "Lantern Pay lets small shops and markets take NEAR payments.",
    });
    let listing = await api.listing("project", "project-1");
    expect(listing?.status).toBe("approved");
    expect(listing?.record?.description).toBe(
      "Lantern Pay lets small shops and markets take NEAR payments.",
    );
    expect(api.propose).toHaveBeenCalledTimes(1);

    await api.client(owner()).updateProject({ id: "project-1", title: "Lantern Checkout" });
    listing = await api.listing("project", "project-1");
    expect(listing?.status).toBe("pending");
    expect(listing?.record?.title).toBe(approvedRecord?.title);
    expect(api.propose).toHaveBeenCalledTimes(2);
    expect(api.records.get("project:project-1")).toMatchObject({
      reviewStatus: "pending",
      payload: expect.objectContaining({
        record: expect.objectContaining({ title: "Lantern Checkout" }),
      }),
    });
  });

  it("takes a project out of the catalog flow when it is made private", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
    await approveProject(api);

    await api.client(owner()).updateProject({ id: "project-1", visibility: "private" });

    const listing = await api.listing("project", "project-1");
    expect(listing?.status).toBe("none");
    expect(listing?.removedAt).not.toBeNull();
  });

  it("withdraws a pending submission when the project is deleted", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

    await api.client(owner()).deleteProject({ id: "project-1" });

    expect(api.records.get("project:project-1")?.reviewStatus).toBe("removed");
    expect((await api.listing("project", "project-1"))?.status).toBe("none");
  });

  it("submits a builder profile and takes it out when the profile is withdrawn", async () => {
    const api = await loadApi();

    const submitted = await api.client(owner()).submitCatalogListing({ kind: "person" });
    expect(submitted.data.status).toBe("pending");
    expect(api.records.get("person:maker.testnet")?.payload.record).toEqual({
      name: "Robin Maker",
      preferredContact: "Telegram",
      description: "Builds payment tools on NEAR.",
      organization: "Lantern",
      team: "",
      jobTitle: "",
      email: "",
      telegram: "https://t.me/robinmaker",
      twitter: "",
      discord: "",
      website: "",
      avatar: "https://lantern.example.com/robin.png",
      nearProjects: "",
      nearAccount: "maker.testnet",
    });

    await api.client(admin()).approve({
      pluginId: "nearcatalog-listing",
      entityId: "person:maker.testnet",
      expectedUpdatedAt: api.records.get("person:maker.testnet")!.updatedAt,
    });
    expect((await api.listing("person", "maker.testnet"))?.status).toBe("approved");

    await api.client(owner()).withdrawMyBuilderProfile({});
    expect((await api.listing("person", "maker.testnet"))?.status).toBe("none");
  });

  it("lets the owner withdraw their own submission", async () => {
    const api = await loadApi();
    await api.client(owner()).submitCatalogListing({ kind: "person" });

    const withdrawn = await api.client(owner()).withdrawMyCatalogListing({ kind: "person" });

    expect(withdrawn.data.status).toBe("none");
    expect(api.records.get("person:maker.testnet")?.reviewStatus).toBe("removed");
  });

  it("does not accept catalog listings through the generic propose route", async () => {
    const api = await loadApi();
    await expect(
      api.client(owner()).propose({
        pluginId: "nearcatalog-listing",
        entityId: "project:project-1",
        payload: {},
      }),
    ).rejects.toThrow(/NEAR Catalog listing endpoint/);
  });
});
