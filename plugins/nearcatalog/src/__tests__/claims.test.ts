import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { describe, expect, it } from "vitest";
import { createDatabaseDriver } from "../db";
import { createClaimMethods } from "../services/claims";

async function createService() {
  const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-nearcatalog-"));
  const driver = await createDatabaseDriver(`pglite:${dataDir}`);
  await driver.db.execute(sql`
    CREATE TABLE "nearcatalog_claims" (
      "id" text PRIMARY KEY NOT NULL,
      "near_account" text NOT NULL,
      "project_slug" text NOT NULL,
      "roles" jsonb NOT NULL,
      "activity_event_id" text,
      "revoked_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "nearcatalog_claims_builder_project_unique"
        UNIQUE("near_account", "project_slug")
    )
  `);
  await driver.db.execute(sql`
    CREATE TABLE "nearcatalog_claim_history" (
      "id" text PRIMARY KEY NOT NULL,
      "claim_id" text NOT NULL,
      "near_account" text NOT NULL,
      "project_slug" text NOT NULL,
      "roles" jsonb NOT NULL,
      "activity_event_id" text,
      "action" text NOT NULL,
      "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  return {
    claims: createClaimMethods(driver.db),
    cleanup: async () => {
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

describe("Catalog claims", { timeout: 15_000 }, () => {
  it("stores one active claim per builder/project and supports multiple contributors", async () => {
    const { claims, cleanup } = await createService();

    try {
      const first = await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "Alice.NEAR",
          projectSlug: "ref-finance",
          roles: ["Developer", "developer", " Designer "],
        }),
      );
      const updated = await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "alice.near",
          projectSlug: "ref-finance",
          roles: ["Founder"],
        }),
      );
      await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "bob.near",
          projectSlug: "ref-finance",
          roles: ["Community"],
        }),
      );
      await Effect.runPromise(claims.setClaimActivity("claim:alice.near:ref-finance", "act-alice"));
      await Effect.runPromise(claims.setClaimActivity("claim:bob.near:ref-finance", "act-bob"));

      const projectClaims = await Effect.runPromise(
        claims.listClaims({ projectSlug: "ref-finance" }),
      );

      expect(first.id).toBe("claim:alice.near:ref-finance");
      expect(first.roles).toEqual(["Developer", "Designer"]);
      expect(updated.id).toBe(first.id);
      expect(updated.roles).toEqual(["Founder"]);
      expect(projectClaims.meta.total).toBe(2);
    } finally {
      await cleanup();
    }
  });

  it("links activity, excludes revoked claims, and reactivates the same record", async () => {
    const { claims, cleanup } = await createService();

    try {
      const applied = await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "alice.near",
          projectSlug: "ref-finance",
          roles: ["Developer"],
        }),
      );
      const linked = await Effect.runPromise(claims.setClaimActivity(applied.id, "act_1"));
      const updated = await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "alice.near",
          projectSlug: "ref-finance",
          roles: ["Developer", "Reviewer"],
        }),
      );
      const revoked = await Effect.runPromise(claims.revokeClaim(applied.id));
      const hidden = await Effect.runPromise(claims.listClaims({ nearAccount: "alice.near" }));
      const reactivated = await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "alice.near",
          projectSlug: "ref-finance",
          roles: ["Product"],
        }),
      );

      expect(linked.activityEventId).toBe("act_1");
      expect(updated.activityEventId).toBe("act_1");
      expect(revoked.revokedAt).not.toBeNull();
      expect(hidden.data).toEqual([]);
      expect(reactivated.id).toBe(applied.id);
      expect(reactivated.roles).toEqual(["Product"]);
      expect(reactivated.activityEventId).toBeNull();
      expect(reactivated.revokedAt).toBeNull();

      const history = await Effect.runPromise(claims.getClaimHistory(applied.id));

      expect(history.filter((entry) => entry.action === "applied")).toHaveLength(3);
      expect(history.find((entry) => entry.action === "revoked")?.activityEventId).toBe("act_1");
    } finally {
      await cleanup();
    }
  });

  it("paginates public claims and lists distinct active projects", async () => {
    const { claims, cleanup } = await createService();

    try {
      await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "alice.near",
          projectSlug: "project-one",
          roles: ["Developer"],
        }),
      );
      await Effect.runPromise(claims.setClaimActivity("claim:alice.near:project-one", "act-one"));
      await Effect.runPromise(
        claims.applyClaim({
          nearAccount: "bob.near",
          projectSlug: "project-two",
          roles: ["Designer"],
        }),
      );
      await Effect.runPromise(claims.setClaimActivity("claim:bob.near:project-two", "act-two"));

      const firstPage = await Effect.runPromise(claims.listClaims({ limit: 1 }));
      const grouped = await Effect.runPromise(claims.listClaimsByProject());
      const personal = await Effect.runPromise(claims.listClaimsByProject("alice.near"));

      expect(firstPage.data).toHaveLength(1);
      expect(firstPage.meta).toMatchObject({ total: 2, hasMore: true, nextCursor: "1" });
      expect(Array.from(grouped.keys())).toEqual(["project-one", "project-two"]);
      expect(Array.from(personal.keys())).toEqual(["project-one"]);
    } finally {
      await cleanup();
    }
  });
});
