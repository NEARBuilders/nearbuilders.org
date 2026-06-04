import type { Migration } from "virtual:drizzle-migrations.sql";
import { sql } from "drizzle-orm";
import type { ProposalsDatabase } from "./index";

function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

const IDEMPOTENT_ERRORS = /already exists|duplicate.*(table|key|object)|does not exist|cannot drop|duplicate_column|duplicate_table/i;
const COMPATIBLE_HASHES: Record<string, string[]> = {
  fb0c442ab5c44674aa091eb326b64ee14f70e21d4c5a02c0cd515d245310c4ea: [
    "eec69b017bf3e9c6d619db80f8303e59a26af6ae4077e2028f9a9ad39ddd66d3",
  ],
};

function findAppliedHash(appliedHashes: Set<string>, hash: string): string | null {
  if (appliedHashes.has(hash)) return hash;

  for (const compatibleHash of COMPATIBLE_HASHES[hash] ?? []) {
    if (appliedHashes.has(compatibleHash)) return compatibleHash;
  }

  return null;
}

export async function migrate(db: ProposalsDatabase, migrations: Migration[]): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  interface MigrationRow {
    hash: string;
  }

  const rawResult = await db.execute(sql`SELECT hash FROM "drizzle_migrations"`);
  const appliedRows = normalizeRows<MigrationRow>(rawResult);
  const appliedHashes = new Set(appliedRows.map((r) => r.hash));

  for (const migration of migrations) {
    const appliedHash = findAppliedHash(appliedHashes, migration.hash);
    if (appliedHash) {
      if (appliedHash !== migration.hash) {
        console.log(`[Proposals] Recording compatible migration hash: ${migration.tag}`);
        await db.execute(
          sql`INSERT INTO "drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${Date.now()})`,
        );
        appliedHashes.add(migration.hash);
      }
      continue;
    }

    console.log(`[Proposals] Applying migration: ${migration.tag}`);

    for (const statement of migration.sql) {
      try {
        await db.execute(sql.raw(statement));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (IDEMPOTENT_ERRORS.test(msg)) {
          console.log(`[Proposals] Skipping statement (already applied): ${statement.slice(0, 80)}`);
          continue;
        }
        throw err;
      }
    }

    await db.execute(
      sql`INSERT INTO "drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${Date.now()})`,
    );
    appliedHashes.add(migration.hash);
  }
}
