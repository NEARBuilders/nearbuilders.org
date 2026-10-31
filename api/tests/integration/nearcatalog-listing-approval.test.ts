import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { Effect } from "effect";
import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG_LISTING_SYNC } from "../../../plugins/nearcatalog/src/contract";
import { createDatabaseDriver } from "../../../plugins/nearcatalog/src/db";
import { createCatalogSubmitClientFromConfig } from "../../../plugins/nearcatalog/src/services/catalog-submit";
import {
  createExportMethods,
  createListingMethods,
} from "../../../plugins/nearcatalog/src/services/listings";
import ApiPlugin from "../../src/index";
import { AUTO_APPROVAL_ACTOR_ID } from "../../src/services/approval-settings";
import { asPluginEntries } from "../helpers/plugin-entries";

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
const migrations = ["0002_catalog_listings.sql", "0003_catalog_listing_sends.sql"].map((file) =>
  join(import.meta.dirname, "../../../plugins/nearcatalog/src/db/migrations", file),
);
const submitUrl = "https://submit.catalog.example/v1";
const submitToken = "nc-test-token-7f3a9e";

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
      locale: null,
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

  async function loadApi(
    options: { requireAdminApproval?: string; submitFetch?: typeof fetch } = {},
  ) {
    const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-catalog-listing-"));
    const driver = await createDatabaseDriver(`pglite:${dataDir}`);
    for (const file of migrations) {
      for (const statement of (await readFile(file, "utf8")).split("--> statement-breakpoint")) {
        await driver.db.execute(sql.raw(statement));
      }
    }
    const submitter = options.submitFetch
      ? createCatalogSubmitClientFromConfig({
          url: submitUrl,
          token: submitToken,
          contactInfo: "team@nearbuilders.example",
          fetchImplementation: options.submitFetch,
        })
      : null;
    const listingMethods = createListingMethods(driver.db, submitter);
    const exportMethods = createExportMethods(driver.db);
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
    const loaded = await runtime.usePlugin(
      "api",
      { variables: {}, secrets },
      asPluginEntries({
        activity: () => ({ emitTrustedActivity: async () => ({}) }),
        builders: () => ({
          getMyBuilderProfile: async () => ({ data: builders.get("maker.testnet") ?? null }),
          getBuilder: async ({ nearAccount }: { nearAccount: string }) => {
            const builder = builders.get(nearAccount);
            if (!builder)
              throw Object.assign(new Error("Builder not found"), { code: "NOT_FOUND" });
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
            listCatalogListings: async ({ kind }: { kind: "project" | "person" }) => ({
              data: await runListing(listingMethods.listListed(kind)),
            }),
            markCatalogListingPublished: async (input: never) => ({
              data: await runListing(listingMethods.markPublished(input)),
            }),
            listCatalogListingSends: async () => await runListing(listingMethods.listSends()),
            retryCatalogListingSend: async (input: never) => ({
              data: await runListing(listingMethods.retrySend(input)),
            }),
            exportCatalogProjects: async ({ since }: { since?: string }) =>
              await runListing(exportMethods.exportProjects(since)),
            exportCatalogPeople: async ({ since }: { since?: string }) =>
              await runListing(exportMethods.exportPeople(since)),
          };
        },
        notifications: () => ({ createNotification }),
        projects: () => ({
          getProject: async ({ id }: { id: string }) => {
            const project = projects.get(id);
            if (!project)
              throw Object.assign(new Error("Project not found"), { code: "NOT_FOUND" });
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
      } as never),
    );

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
      contact: "https://t.me/robinmaker",
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

  describe("export", () => {
    it("leaves out projects and profiles nobody submitted or approved", async () => {
      const api = await loadApi();
      const anonymous = api.client({});
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

      await expect(anonymous.exportCatalogProjects({})).resolves.toMatchObject({ data: [] });
      await expect(anonymous.exportCatalogPeople({})).resolves.toMatchObject({ data: [] });
    });

    it("exports an approved project and reports it as removed once it goes private", async () => {
      const api = await loadApi();
      const anonymous = api.client({});
      const since = new Date(Date.now() - 60_000).toISOString();
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      await approveProject(api);

      const listed = await anonymous.exportCatalogProjects({});
      expect(listed.data).toEqual([api.records.get("project:project-1")?.payload.record]);

      await api.client(owner()).updateProject({ id: "project-1", visibility: "private" });

      const after = await anonymous.exportCatalogProjects({ since });
      expect(after.data).toEqual([]);
      expect(after.removed).toEqual([
        expect.objectContaining({ slug: "lantern-pay", nearAccount: "maker.testnet" }),
      ]);
    });

    it("never exports the sign-in email or other private profile fields", async () => {
      const api = await loadApi();
      api.builders.set(
        "maker.testnet",
        catalogBuilder({
          catalog: { preferredContact: "Telegram", organization: "Lantern" },
          links: { telegram: "https://t.me/robinmaker", linkedin: "https://linkedin.com/in/r" },
        }),
      );
      const resolveAvatar = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            "maker.testnet": { profile: { image: { ipfs_cid: "bafyexample" } } },
          }),
        ),
      );
      try {
        await api.client(owner()).submitCatalogListing({ kind: "person" });
        await api.client(admin()).approve({
          pluginId: "nearcatalog-listing",
          entityId: "person:maker.testnet",
          expectedUpdatedAt: api.records.get("person:maker.testnet")!.updatedAt,
        });
      } finally {
        resolveAvatar.mockRestore();
      }

      const people = await api.client({}).exportCatalogPeople({});
      expect(people.data).toHaveLength(1);
      expect(people.data[0]).toMatchObject({
        email: "",
        avatar: "https://ipfs.near.social/ipfs/bafyexample",
      });
      const serialized = JSON.stringify(people);
      expect(serialized).not.toContain("owner-user@example.com");
      expect(serialized).not.toContain("linkedin");
    });
  });

  describe("badge listings", () => {
    it("lists a project for the badge once approved and lets only admins mark it published", async () => {
      const api = await loadApi();
      const anonymous = api.client({});
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      await expect(anonymous.listCatalogListings({ kind: "project" })).resolves.toEqual({
        data: [],
      });

      await approveProject(api);
      await expect(anonymous.listCatalogListings({ kind: "project" })).resolves.toEqual({
        data: [
          {
            kind: "project",
            entityId: "project-1",
            slug: "lantern-pay",
            status: "approved",
            catalogUrl: null,
          },
        ],
      });

      await expect(
        api.client(owner()).markCatalogListingPublished({ kind: "project", entityId: "project-1" }),
      ).rejects.toThrow();
      await api
        .client(admin())
        .markCatalogListingPublished({ kind: "project", entityId: "project-1" });
      const listed = await anonymous.listCatalogListings({ kind: "project" });
      expect(listed.data[0]).toMatchObject({
        status: "published",
        catalogUrl: "https://nearcatalog.xyz/project/lantern-pay",
      });
    });
  });
  describe("sending to NEAR Catalog", () => {
    type SentRequest = { method: string; url: string; authorization: string | null; body: any };

    function catalogApi(replies: Array<() => Response | Promise<Response>> = []) {
      const requests: SentRequest[] = [];
      const submitFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        requests.push({
          method: String(init?.method),
          url: String(input),
          authorization: headers.get("authorization"),
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        const reply = replies.shift();
        if (reply) return await reply();
        return Response.json({ status: "success", submission_id: "sub-1" });
      });
      return { requests, submitFetch: submitFetch as unknown as typeof fetch };
    }

    it("sends nothing and stores no error when it isn't set up", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const api = await loadApi();
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      await approveProject(api);

      const listing = await api.listing("project", "project-1");
      expect(listing).toMatchObject({ status: "approved", sendStatus: null, sendError: null });
      expect(fetchSpy).not.toHaveBeenCalled();
      await expect(api.client(admin()).listCatalogListingSends()).resolves.toMatchObject({
        enabled: false,
      });
      await expect(
        api.client(admin()).retryCatalogListingSend({ kind: "project", entityId: "project-1" }),
      ).rejects.toThrow(/not set up/);
      fetchSpy.mockRestore();
    });

    it("submits the approved project for NEAR Catalog review", async () => {
      const { requests, submitFetch } = catalogApi();
      const api = await loadApi({ submitFetch });
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      expect(requests).toHaveLength(0);

      await approveProject(api);

      expect(requests).toEqual([
        {
          method: "POST",
          url: submitUrl,
          authorization: `Bearer ${submitToken}`,
          body: expect.objectContaining({
            project_name: "Lantern Pay",
            contact_info: "https://t.me/robinmaker",
            uid: "project:project-1",
          }),
        },
      ]);
      expect(await api.listing("project", "project-1")).toMatchObject({
        status: "approved",
        catalogUrl: null,
        sendStatus: "sent",
        sendAction: "upsert",
      });
      const sends = await api.client(admin()).listCatalogListingSends();
      expect(sends.data[0]).toMatchObject({ entityId: "project-1", teamContact: true });
    });

    it("falls back to the NearBuilders contact and flags a project with no public team contact", async () => {
      const { requests, submitFetch } = catalogApi();
      const api = await loadApi({ submitFetch });
      api.builders.delete("maker.testnet");
      api.projects.set(
        "project-1",
        catalogProject({
          catalog: { ...catalogProject().catalog, links: {} },
        }),
      );
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

      await approveProject(api);

      expect(requests[0]?.body.contact_info).toBe("team@nearbuilders.example");
      const sends = await api.client(admin()).listCatalogListingSends();
      expect(sends.data[0]).toMatchObject({ sendStatus: "sent", teamContact: false });
    });

    it("resubmits small edits, waits on big edits until re-approved, then resubmits", async () => {
      const { requests, submitFetch } = catalogApi();
      const api = await loadApi({ submitFetch });
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      await approveProject(api);

      await api.client(owner()).updateProject({
        id: "project-1",
        description: "Lantern Pay lets small shops and markets take NEAR payments.",
      });
      expect(requests).toHaveLength(2);
      expect(requests[1]?.body.project_description).toBe(
        "Lantern Pay lets small shops and markets take NEAR payments.",
      );

      await api.client(owner()).updateProject({ id: "project-1", title: "Lantern Checkout" });
      expect(requests).toHaveLength(2);
      expect((await api.listing("project", "project-1"))?.status).toBe("pending");

      await approveProject(api);
      expect(requests).toHaveLength(3);
      expect(requests.map((request) => request.body.uid)).toEqual(
        Array(3).fill("project:project-1"),
      );
      expect(requests[2]?.body.project_name).toBe("Lantern Checkout");
    });

    it("sends no people, and flags a sent project made private for manual removal", async () => {
      const { requests, submitFetch } = catalogApi();
      const api = await loadApi({ submitFetch });
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      await approveProject(api);
      await api.client(owner()).submitCatalogListing({ kind: "person" });
      await api.client(admin()).approve({
        pluginId: "nearcatalog-listing",
        entityId: "person:maker.testnet",
        expectedUpdatedAt: api.records.get("person:maker.testnet")!.updatedAt,
      });

      await api.client(owner()).updateProject({ id: "project-1", visibility: "private" });
      await api.client(owner()).withdrawMyBuilderProfile({});

      expect(requests.map((request) => request.body.uid)).toEqual(["project:project-1"]);
      expect(await api.listing("person", "maker.testnet")).toMatchObject({ sendStatus: null });
      const removed = await api.listing("project", "project-1");
      expect(removed).toMatchObject({
        status: "none",
        sendStatus: "failed",
        sendAction: "remove",
      });
      expect(removed?.sendError).toMatch(/no partner remove route/);
    });

    it("never sends a removal for a listing that was never sent", async () => {
      const { requests, submitFetch } = catalogApi();
      const api = await loadApi({ submitFetch });
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      const proposal = api.records.get("project:project-1")!;
      await api.client(admin()).reject({
        pluginId: "nearcatalog-listing",
        entityId: "project:project-1",
        expectedUpdatedAt: proposal.updatedAt,
        reason: "Logo is a placeholder",
      });

      expect(requests).toHaveLength(0);
      expect((await api.listing("project", "project-1"))?.sendStatus).toBeNull();
    });

    it("keeps the approval when NEAR Catalog fails and lets an admin retry once", async () => {
      const { requests, submitFetch } = catalogApi([
        () => new Response(`upstream error for ${submitToken}`, { status: 502 }),
      ]);
      const api = await loadApi({ submitFetch });
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

      const approved = await approveProject(api);

      expect(approved.data.applyStatus).toBe("applied");
      const failed = await api.listing("project", "project-1");
      expect(failed).toMatchObject({
        status: "approved",
        sendStatus: "failed",
        sendAction: "upsert",
      });
      expect(failed?.sendError).toContain("NEAR Catalog returned 502");
      expect(failed?.sendError).not.toContain(submitToken);

      const sends = await api.client(admin()).listCatalogListingSends();
      expect(sends.enabled).toBe(true);
      expect(sends.data[0]).toMatchObject({
        kind: "project",
        entityId: "project-1",
        title: "Lantern Pay",
        sendStatus: "failed",
      });
      await expect(
        api.client(owner()).retryCatalogListingSend({ kind: "project", entityId: "project-1" }),
      ).rejects.toThrow();

      const retried = await api
        .client(admin())
        .retryCatalogListingSend({ kind: "project", entityId: "project-1" });

      expect(retried.data).toMatchObject({ status: "approved", sendStatus: "sent" });
      expect(requests.map((request) => request.body.uid)).toEqual([
        "project:project-1",
        "project:project-1",
      ]);
      await expect(
        api.client(admin()).retryCatalogListingSend({ kind: "project", entityId: "project-1" }),
      ).rejects.toThrow(/Nothing to send/);
      expect(requests).toHaveLength(2);
    });

    it("times out quickly when NEAR Catalog doesn't answer", async () => {
      const api = await loadApi({
        submitFetch: ((_input: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          })) as typeof fetch,
      });
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });

      const started = Date.now();
      await approveProject(api);

      expect(Date.now() - started).toBeLessThan(8000);
      expect((await api.listing("project", "project-1"))?.sendError).toMatch(/timed out/);
    }, 15_000);

    it("never returns or logs the token", async () => {
      const logged = (["log", "info", "warn", "error", "debug"] as const).map((level) =>
        vi.spyOn(console, level),
      );
      const { submitFetch } = catalogApi([
        () => new Response(`bad token ${submitToken}`, { status: 401 }),
      ]);
      const api = await loadApi({ submitFetch });
      await api.client(owner()).submitCatalogListing({ kind: "project", projectId: "project-1" });
      await approveProject(api);

      const responses = await Promise.all([
        api.client(admin()).listCatalogListingSends(),
        api.client(owner()).getMyCatalogListing({ kind: "project", projectId: "project-1" }),
        api.client({}).listCatalogListings({ kind: "project" }),
        api.client({}).exportCatalogProjects({}),
      ]);
      for (const response of responses) {
        expect(JSON.stringify(response)).not.toContain(submitToken);
      }
      for (const spy of logged) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(submitToken);
        spy.mockRestore();
      }
    });
  });
});
