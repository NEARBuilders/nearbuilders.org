import type { Migration } from "virtual:drizzle-migrations.sql";
import { sql } from "drizzle-orm";
import type { EventsDatabase } from "./index";

function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

const IDEMPOTENT_ERRORS =
  /already exists|duplicate.*(table|key|object)|does not exist|cannot drop|duplicate_column|duplicate_table/i;

export async function migrate(db: EventsDatabase, migrations: Migration[]): Promise<void> {
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
    if (appliedHashes.has(migration.hash)) continue;

    console.log(`[Events] Applying migration: ${migration.tag}`);

    for (const statement of migration.sql) {
      try {
        await db.execute(sql.raw(statement));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (IDEMPOTENT_ERRORS.test(msg)) {
          console.log(`[Events] Skipping statement (already applied): ${statement.slice(0, 80)}`);
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
