import type { Migration } from "virtual:drizzle-migrations.sql";
import { sql } from "drizzle-orm";
import type { ProjectsDatabase } from "./index";

function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

const IDEMPOTENT_ERRORS = /already exists|duplicate.*(table|key|object)|does not exist|cannot drop|duplicate_column|duplicate_table/i;
const COMPATIBLE_HASHES: Record<string, string[]> = {
  "10ff5a290c1240e063913d613083c7ca7dadf608560d9aa3875282d8c14dd8d1": [
    "5826b3bed1ebd1cbb32dbc7842b763a2459b2519bf5f33c5428266dd19c85742",
  ],
  cb55677b667f60e6f96f1e392d321a8544e5ecb2fd95cb987020e3fe54c32ea2: [
    "cacc2ad7a34e8b806aad21f07ec3959881fb523089160a8d3ff5dc0c57d93963",
  ],
  "21db2b23a4120dfab899328da72c34dd241451cc37fcf8b2cb4a9f4aefa76d0c": [
    "a2218bb991245d81a6d4578a9191488698b3c6a1a204a1aecd36bcdf8eeb803c",
  ],
};

function findAppliedHash(appliedHashes: Set<string>, hash: string): string | null {
  if (appliedHashes.has(hash)) return hash;

  for (const compatibleHash of COMPATIBLE_HASHES[hash] ?? []) {
    if (appliedHashes.has(compatibleHash)) return compatibleHash;
  }

  return null;
}

export async function migrate(db: ProjectsDatabase, migrations: Migration[]): Promise<void> {
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
        console.log(`[Projects] Recording compatible migration hash: ${migration.tag}`);
        await db.execute(
          sql`INSERT INTO "drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${Date.now()})`,
        );
        appliedHashes.add(migration.hash);
      }
      continue;
    }

    console.log(`[Projects] Applying migration: ${migration.tag}`);

    for (const statement of migration.sql) {
      try {
        await db.execute(sql.raw(statement));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (IDEMPOTENT_ERRORS.test(msg)) {
          console.log(`[Projects] Skipping statement (already applied): ${statement.slice(0, 80)}`);
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
