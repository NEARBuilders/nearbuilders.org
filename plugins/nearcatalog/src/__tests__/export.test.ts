import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { describe, expect, it } from "vitest";
import { CatalogExportPersonSchema, CatalogExportProjectSchema } from "../contract";
import { createDatabaseDriver } from "../db";
import { nearcatalogListings } from "../db/schema";
import { createExportMethods, createListingMethods } from "../services/listings";

function projectRecord(slug: string, title: string, owner = "maker.testnet") {
  return {
    slug,
    title,
    oneliner: `${title} in one line`,
    description: `${title} helps builders ship on NEAR.`,
    logo: `https://${slug}.example.com/logo.png`,
    categories: ["developer-tooling"],
    website: `https://${slug}.example.com/`,
    twitter: "",
    medium: "",
    telegram: "",
    github: "",
    discord: "",
    whitepaper: "",
    "token-address": "",
    "coingecko-address": "",
    "nearsocial-address": "",
    dapp: "",
    phase: "mainnet",
    source: {
      site: "nearbuilders.org",
      url: `https://nearbuilders.org/projects/project/${slug}`,
      nearAccount: owner,
      updatedAt: "2026-10-26T00:00:00.000Z",
    },
  };
}

function personRecord(nearAccount: string, name: string) {
  return {
    name,
    preferredContact: "Telegram",
    description: `${name} builds on NEAR.`,
    organization: "Example Labs",
    team: "",
    jobTitle: "Engineer",
    email: "",
    telegram: `https://t.me/${nearAccount.split(".")[0]}`,
    twitter: "",
    discord: "",
    website: "",
    avatar: "",
    nearProjects: "",
    nearAccount,
  };
}

async function createService() {
  const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-nearcatalog-export-"));
  const driver = await createDatabaseDriver(`pglite:${dataDir}`);
  for (const file of ["0002_catalog_listings.sql", "0003_catalog_listing_sends.sql"]) {
    const migration = await readFile(join(import.meta.dirname, "../db/migrations", file), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      await driver.db.execute(sql.raw(statement));
    }
  }
  const listings = createListingMethods(driver.db);
  const exports = createExportMethods(driver.db);
  const approve = async (
    kind: "project" | "person",
    entityId: string,
    ownerId: string,
    slug: string,
    record: Record<string, unknown>,
  ) => {
    await Effect.runPromise(listings.markPending({ kind, entityId, ownerId, slug }));
    await Effect.runPromise(
      listings.approve({ kind, entityId, ownerId, slug, record, approvedBy: "reviewer.testnet" }),
    );
  };
  return {
    db: driver.db,
    listings,
    exports,
    approve,
    cleanup: async () => {
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

describe("NEAR Catalog export", { timeout: 20_000 }, () => {
  it("exports only approved projects in NEAR Catalog's field names", async () => {
    const service = await createService();
    try {
      await service.approve(
        "project",
        "project-1",
        "maker.testnet",
        "lantern-pay",
        projectRecord("lantern-pay", "Lantern Pay"),
      );
      await Effect.runPromise(
        service.listings.markPending({
          kind: "project",
          entityId: "project-2",
          ownerId: "maker.testnet",
          slug: "pending-tool",
        }),
      );

      const result = await Effect.runPromise(service.exports.exportProjects());

      expect(result.data.map((project) => project.slug)).toEqual(["lantern-pay"]);
      expect(CatalogExportProjectSchema.array().parse(result.data)).toEqual(result.data);
      expect(Object.keys(result.data[0]!)).toEqual(
        Object.keys(projectRecord("lantern-pay", "Lantern Pay")),
      );
      expect(result.removed).toEqual([]);
      expect(result.meta).toMatchObject({ since: null, count: 1 });
    } finally {
      await service.cleanup();
    }
  });

  it("leaves out rejected and withdrawn projects and reports them as removals", async () => {
    const service = await createService();
    try {
      const since = new Date(Date.now() - 60_000).toISOString();
      await service.approve(
        "project",
        "project-1",
        "maker.testnet",
        "lantern-pay",
        projectRecord("lantern-pay", "Lantern Pay"),
      );
      await service.approve(
        "project",
        "project-2",
        "other.testnet",
        "harbor-dex",
        projectRecord("harbor-dex", "Harbor DEX", "other.testnet"),
      );
      await service.approve(
        "project",
        "project-3",
        "third.testnet",
        "quiet-wallet",
        projectRecord("quiet-wallet", "Quiet Wallet", "third.testnet"),
      );
      await Effect.runPromise(
        service.listings.withdraw({ kind: "project", entityId: "project-1" }),
      );
      await Effect.runPromise(
        service.listings.markPending({
          kind: "project",
          entityId: "project-2",
          ownerId: "other.testnet",
          slug: "harbor-dex",
        }),
      );
      await Effect.runPromise(service.listings.reject({ kind: "project", entityId: "project-2" }));

      const full = await Effect.runPromise(service.exports.exportProjects());
      expect(full.data.map((project) => project.slug)).toEqual(["quiet-wallet"]);

      const incremental = await Effect.runPromise(service.exports.exportProjects(since));
      expect(incremental.data.map((project) => project.slug)).toEqual(["quiet-wallet"]);
      expect(incremental.removed.map((removal) => removal.slug).sort()).toEqual([
        "harbor-dex",
        "lantern-pay",
      ]);
      expect(incremental.removed.find((removal) => removal.slug === "harbor-dex")).toMatchObject({
        nearAccount: "other.testnet",
      });
    } finally {
      await service.cleanup();
    }
  });

  it("returns only records that changed after since", async () => {
    const service = await createService();
    try {
      await service.approve(
        "project",
        "project-1",
        "maker.testnet",
        "lantern-pay",
        projectRecord("lantern-pay", "Lantern Pay"),
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      const since = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await service.approve(
        "project",
        "project-2",
        "other.testnet",
        "harbor-dex",
        projectRecord("harbor-dex", "Harbor DEX", "other.testnet"),
      );

      const result = await Effect.runPromise(service.exports.exportProjects(since));
      expect(result.data.map((project) => project.slug)).toEqual(["harbor-dex"]);
      expect(result.meta.since).toBe(since);

      await Effect.runPromise(
        service.listings.refreshRecord({
          kind: "project",
          entityId: "project-1",
          record: { ...projectRecord("lantern-pay", "Lantern Pay"), phase: "inactive" },
        }),
      );
      const refreshed = await Effect.runPromise(service.exports.exportProjects(since));
      expect(refreshed.data.map((project) => project.slug).sort()).toEqual([
        "harbor-dex",
        "lantern-pay",
      ]);
    } finally {
      await service.cleanup();
    }
  });

  it("keeps the last approved version listed while changes are in review", async () => {
    const service = await createService();
    try {
      await service.approve(
        "project",
        "project-1",
        "maker.testnet",
        "lantern-pay",
        projectRecord("lantern-pay", "Lantern Pay"),
      );
      await Effect.runPromise(
        service.listings.markPending({
          kind: "project",
          entityId: "project-1",
          ownerId: "maker.testnet",
          slug: "lantern-checkout",
        }),
      );

      const result = await Effect.runPromise(service.exports.exportProjects());
      expect(result.data).toEqual([projectRecord("lantern-pay", "Lantern Pay")]);
    } finally {
      await service.cleanup();
    }
  });

  it("drops stored records that carry fields outside NEAR Catalog's format", async () => {
    const service = await createService();
    try {
      const now = new Date();
      await service.db.insert(nearcatalogListings).values({
        id: "project:project-9",
        kind: "project",
        entityId: "project-9",
        ownerId: "maker.testnet",
        slug: "leaky",
        status: "approved",
        record: { ...projectRecord("leaky", "Leaky"), funding: "private funding note" },
        changedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const result = await Effect.runPromise(service.exports.exportProjects());
      expect(result.data).toEqual([]);
    } finally {
      await service.cleanup();
    }
  });

  it("exports approved people with their approved projects and nothing else", async () => {
    const service = await createService();
    try {
      const since = new Date(Date.now() - 60_000).toISOString();
      await service.approve(
        "person",
        "maker.testnet",
        "maker.testnet",
        "maker.testnet",
        personRecord("maker.testnet", "Robin Maker"),
      );
      await service.approve(
        "person",
        "gone.testnet",
        "gone.testnet",
        "gone.testnet",
        personRecord("gone.testnet", "Sam Gone"),
      );
      await Effect.runPromise(
        service.listings.markPending({
          kind: "person",
          entityId: "waiting.testnet",
          ownerId: "waiting.testnet",
          slug: "waiting.testnet",
        }),
      );
      await service.approve(
        "project",
        "project-1",
        "maker.testnet",
        "lantern-pay",
        projectRecord("lantern-pay", "Lantern Pay"),
      );
      await Effect.runPromise(
        service.listings.withdraw({ kind: "person", entityId: "gone.testnet" }),
      );

      const result = await Effect.runPromise(service.exports.exportPeople(since));

      expect(result.data).toEqual([
        { ...personRecord("maker.testnet", "Robin Maker"), nearProjects: "Lantern Pay" },
      ]);
      expect(CatalogExportPersonSchema.array().parse(result.data)).toEqual(result.data);
      expect(result.removed).toEqual([
        expect.objectContaining({ nearAccount: "gone.testnet", name: "Sam Gone" }),
      ]);
    } finally {
      await service.cleanup();
    }
  });
});
