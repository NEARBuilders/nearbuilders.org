import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import { proposals } from "../db/schema";
import { sameVersion } from "../services/proposals";

describe("sameVersion", () => {
  it("matches rows whose stored timestamp has sub-millisecond precision", async () => {
    const client = new PGlite();
    const db = drizzle(client);
    const migration = await readFile(
      new URL("../db/migrations/0000_concerned_blade.sql", import.meta.url),
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
    await client.exec(`
      insert into proposals (id, plugin_id, entity_id, payload, created_by, created_at, updated_at)
      values ('p1', 'builders', 'alice.near', '{}', 'alice.near',
              '2026-09-26 01:30:07.780683+00', '2026-09-26 01:30:07.780683+00');
    `);
    const [row] = await db.select().from(proposals).where(eq(proposals.id, "p1"));

    const exact = await db
      .update(proposals)
      .set({ reviewStatus: "approved" })
      .where(and(eq(proposals.id, "p1"), eq(proposals.updatedAt, row!.updatedAt)))
      .returning({ id: proposals.id });
    const truncated = await db
      .update(proposals)
      .set({ reviewStatus: "approved" })
      .where(and(eq(proposals.id, "p1"), sameVersion(row!.updatedAt)))
      .returning({ id: proposals.id });
    const stale = await db
      .update(proposals)
      .set({ reviewStatus: "rejected" })
      .where(and(eq(proposals.id, "p1"), sameVersion(new Date(row!.updatedAt.getTime() - 1))))
      .returning({ id: proposals.id });

    expect(exact).toEqual([]);
    expect(truncated).toEqual([{ id: "p1" }]);
    expect(stale).toEqual([]);
    await client.close();
  });
});
