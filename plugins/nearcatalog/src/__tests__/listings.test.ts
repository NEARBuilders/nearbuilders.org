import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { createDatabaseDriver } from "../db";
import { createListingMethods } from "../services/listings";

const projectRecord = {
  slug: "lantern-pay",
  title: "Lantern Pay",
  oneliner: "Payments for small shops",
  description: "Lantern Pay lets small shops take NEAR payments.",
  logo: "https://lantern.example.com/logo.png",
  categories: ["payment"],
  website: "https://lantern.example.com/",
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
  phase: "testnet",
  source: {
    site: "nearbuilders.org",
    url: "https://nearbuilders.org/projects/project/lantern-pay-x1",
    nearAccount: "maker.testnet",
    updatedAt: "2026-10-26T00:00:00.000Z",
  },
};

async function createService() {
  const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-nearcatalog-listings-"));
  const driver = await createDatabaseDriver(`pglite:${dataDir}`);
  const migration = await readFile(
    join(import.meta.dirname, "../db/migrations/0002_catalog_listings.sql"),
    "utf8",
  );
  for (const statement of migration.split("--> statement-breakpoint")) {
    await driver.db.execute(sql.raw(statement));
  }
  return {
    listings: createListingMethods(driver.db),
    cleanup: async () => {
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

const project = { kind: "project" as const, entityId: "project-1" };

describe("Catalog listings", { timeout: 15_000 }, () => {
  it("moves a listing through pending, approved, re-review and removal", async () => {
    const { listings, cleanup } = await createService();
    try {
      const pending = await Effect.runPromise(
        listings.markPending({ ...project, ownerId: "maker.testnet", slug: "lantern-pay" }),
      );
      expect(pending).toMatchObject({ status: "pending", record: null, slug: "lantern-pay" });

      const approved = await Effect.runPromise(
        listings.approve({
          ...project,
          ownerId: "maker.testnet",
          slug: "lantern-pay",
          record: projectRecord,
          approvedBy: "reviewer.testnet",
        }),
      );
      expect(approved).toMatchObject({ status: "approved", approvedBy: "reviewer.testnet" });
      expect(approved.record).toEqual(projectRecord);

      const rereview = await Effect.runPromise(
        listings.markPending({ ...project, ownerId: "maker.testnet", slug: "lantern-checkout" }),
      );
      expect(rereview).toMatchObject({ status: "pending", slug: "lantern-pay" });
      expect(rereview.record).toEqual(projectRecord);

      const withdrawn = await Effect.runPromise(listings.withdraw(project));
      expect(withdrawn?.status).toBe("none");
      expect(withdrawn?.removedAt).not.toBeNull();

      const resubmitted = await Effect.runPromise(
        listings.markPending({ ...project, ownerId: "maker.testnet", slug: "lantern-pay" }),
      );
      expect(resubmitted.record).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("only refreshes the record of an approved listing", async () => {
    const { listings, cleanup } = await createService();
    try {
      await Effect.runPromise(
        listings.markPending({ ...project, ownerId: "maker.testnet", slug: "lantern-pay" }),
      );
      const ignored = await Effect.runPromise(
        listings.refreshRecord({ ...project, record: projectRecord }),
      );
      expect(ignored?.record).toBeNull();

      await Effect.runPromise(
        listings.approve({
          ...project,
          ownerId: "maker.testnet",
          slug: "lantern-pay",
          record: projectRecord,
          approvedBy: "reviewer.testnet",
        }),
      );
      const refreshed = await Effect.runPromise(
        listings.refreshRecord({ ...project, record: { ...projectRecord, phase: "mainnet" } }),
      );
      expect(refreshed?.record?.phase).toBe("mainnet");
    } finally {
      await cleanup();
    }
  });

  it("rejects records with fields NEAR Catalog does not take", async () => {
    const { listings, cleanup } = await createService();
    try {
      const exit = await Effect.runPromiseExit(
        listings.approve({
          ...project,
          ownerId: "maker.testnet",
          slug: "lantern-pay",
          record: { ...projectRecord, funding: "private note" },
          approvedBy: "reviewer.testnet",
        }),
      );
      expect(Exit.isFailure(exit)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("gives a second project with the same slug a distinct one", async () => {
    const { listings, cleanup } = await createService();
    try {
      await Effect.runPromise(
        listings.markPending({ ...project, ownerId: "maker.testnet", slug: "lantern-pay" }),
      );
      const second = await Effect.runPromise(
        listings.markPending({
          kind: "project",
          entityId: "Project-2",
          ownerId: "other.testnet",
          slug: "lantern-pay",
        }),
      );
      expect(second.slug).toBe("lantern-pay-projec");
    } finally {
      await cleanup();
    }
  });

  it("lists approved and published listings for badges", async () => {
    const { listings, cleanup } = await createService();
    try {
      await Effect.runPromise(
        listings.markPending({ ...project, ownerId: "maker.testnet", slug: "lantern-pay" }),
      );
      expect(await Effect.runPromise(listings.listListed("project"))).toEqual([]);

      await Effect.runPromise(
        listings.approve({
          ...project,
          ownerId: "maker.testnet",
          slug: "lantern-pay",
          record: projectRecord,
          approvedBy: "reviewer.testnet",
        }),
      );
      expect(await Effect.runPromise(listings.listListed("project"))).toEqual([
        {
          kind: "project",
          entityId: "project-1",
          slug: "lantern-pay",
          status: "approved",
          catalogUrl: null,
        },
      ]);

      const published = await Effect.runPromise(listings.markPublished(project));
      expect(published).toMatchObject({ status: "published" });
      expect(await Effect.runPromise(listings.listListed("project"))).toEqual([
        expect.objectContaining({
          status: "published",
          catalogUrl: "https://nearcatalog.xyz/project/lantern-pay",
        }),
      ]);

      await Effect.runPromise(listings.withdraw(project));
      expect(await Effect.runPromise(listings.listListed("project"))).toEqual([]);
      const exit = await Effect.runPromiseExit(listings.markPublished(project));
      expect(Exit.isFailure(exit)).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
