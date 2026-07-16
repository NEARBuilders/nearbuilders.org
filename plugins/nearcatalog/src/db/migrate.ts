import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Migration } from "virtual:drizzle-migrations.sql";
import { sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { type Database, DatabaseError } from "./index";

function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export function loadMigrations(): Effect.Effect<Migration[], DatabaseError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => import("virtual:drizzle-migrations.sql") as Promise<{ default?: Migration[] }>,
      catch: (cause) => new DatabaseError({ stage: "load", cause }),
    }).pipe(Effect.either);

    if (result._tag === "Right" && result.right?.default?.length) {
      return result.right.default;
    }

    const reason =
      result._tag === "Left" ? String(result.left.cause) : "no migrations in virtual module";
    yield* Effect.logDebug(
      `[Database] Virtual migrations unavailable (${reason}), loading from disk`,
    );

    return yield* loadMigrationsFromDisk();
  });
}

function loadMigrationsFromDisk(): Effect.Effect<Migration[], DatabaseError> {
  return Effect.try({
    try: () => {
      const migrationsDir = resolve(import.meta.dirname, "migrations");
      const metaDir = join(migrationsDir, "meta");
      const journalPath = join(metaDir, "_journal.json");

      if (!existsSync(journalPath)) {
        throw new Error(
          `Migrations journal not found at ${journalPath}. Run \`db:generate\` first.`,
        );
      }

      const journal = JSON.parse(readFileSync(journalPath, "utf8"));

      return journal.entries.map((entry: { idx: number; when: number; tag: string }) => {
        const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
        if (!existsSync(sqlPath)) {
          throw new Error(`Migration SQL file not found: ${sqlPath}`);
        }
        const raw = readFileSync(sqlPath, "utf8");
        const sqlStatements = raw.split("--> statement-breakpoint").map((s: string) => s.trim());
        const hash = createHash("sha256").update(raw).digest("hex");

        return {
          idx: entry.idx,
          when: entry.when,
          tag: entry.tag,
          hash,
          sql: sqlStatements,
        };
      });
    },
    catch: (cause) => new DatabaseError({ stage: "load", cause }),
  });
}

export function migrate(db: Database, migrations: Migration[]): Effect.Effect<void, DatabaseError> {
  return Effect.gen(function* () {
    const sorted = [...migrations].sort((a, b) => a.idx - b.idx);

    yield* ensureMigrationTable(db);
    yield* migrateLegacyTable(db);

    const rawResult = yield* Effect.tryPromise({
      try: () => db.execute(sql`SELECT hash FROM "drizzle"."__drizzle_migrations"`),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "read-applied", cause }),
    });
    const appliedHashes = new Set(normalizeRows<{ hash: string }>(rawResult).map((r) => r.hash));

    for (const migration of sorted) {
      const isApplied =
        appliedHashes.has(migration.hash) || appliedHashes.has(migration.hash.slice(0, 12));
      if (isApplied) continue;

      yield* Effect.logInfo(`[Database] Applying migration: ${migration.tag}`);

      yield* Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            for (const [i, statement] of migration.sql.entries()) {
              try {
                await tx.execute(sql.raw(statement));
              } catch (cause) {
                throw new DatabaseError({
                  stage: "migration",
                  migrationTag: migration.tag,
                  statementIndex: i,
                  cause,
                });
              }
            }
            await tx.execute(
              sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${migration.when})`,
            );
          }),
        catch: (cause) =>
          cause instanceof DatabaseError
            ? cause
            : new DatabaseError({ stage: "migration", migrationTag: migration.tag, cause }),
      });
    }
  });
}

function ensureMigrationTable(db: Database): Effect.Effect<void, DatabaseError> {
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "init-schema", cause }),
    });

    yield* Effect.tryPromise({
      try: () =>
        db.execute(sql`
          CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          )
        `),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "init-table", cause }),
    });
  });
}

function migrateLegacyTable(db: Database): Effect.Effect<void, DatabaseError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db.execute(sql`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'drizzle_migrations'
        `),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "legacy-check", cause }),
    });

    if (normalizeRows(result).length === 0) return;

    yield* Effect.logInfo(
      "[Database] Migrating legacy drizzle_migrations to drizzle.__drizzle_migrations",
    );

    yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          await tx.execute(sql`
            INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
            SELECT hash, created_at FROM "drizzle_migrations"
            WHERE NOT EXISTS (
              SELECT 1 FROM "drizzle"."__drizzle_migrations" dm
              WHERE dm.hash = "drizzle_migrations".hash
            )
          `);
          await tx.execute(sql`DROP TABLE "drizzle_migrations"`);
        }),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "legacy-migrate", cause }),
    });

    yield* Effect.logInfo("[Database] Legacy migration table migrated successfully");
  });
}
