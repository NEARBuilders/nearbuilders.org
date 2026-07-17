import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Migration } from "virtual:drizzle-migrations.sql";
import { sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import {
  extractExpectedTables,
  getLegacyCandidates,
  getMigrationStorage,
  type MigrationStorage,
} from "everything-dev/db";
import { type Database, DatabaseError } from "./index";

function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export interface LoadedMigrations {
  migrations: Migration[];
  source: "virtual" | "disk";
}

export interface DriftReport {
  status: "healthy" | "empty" | "legacy-importable" | "drift-safe-repair" | "drift-manual";
  expectedTables: string[];
  missingTables: string[];
  appliedHashes: number;
  localHashes: number;
  storage: MigrationStorage;
}

export function loadMigrations(): Effect.Effect<LoadedMigrations, DatabaseError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => import("virtual:drizzle-migrations.sql") as Promise<{ default?: Migration[] }>,
      catch: (cause) => new DatabaseError({ stage: "load", cause }),
    }).pipe(Effect.either);

    if (result._tag === "Right" && result.right?.default?.length) {
      const migrations = result.right.default;
      yield* Effect.logInfo(
        `[Database] Loaded ${migrations.length} migration(s) from virtual module`,
      );
      return { migrations, source: "virtual" as const };
    }

    const reason =
      result._tag === "Left" ? String(result.left.cause) : "no migrations in virtual module";

    if (result._tag === "Left") {
      yield* Effect.logDebug(
        `[Database] Virtual migrations unavailable (${reason}), loading from disk`,
      );
    } else {
      yield* Effect.logInfo("[Database] Virtual migrations empty, loading from disk");
    }

    const diskResult = yield* loadMigrationsFromDisk().pipe(Effect.either);

    if (diskResult._tag === "Right") {
      const migrations = diskResult.right;
      yield* Effect.logInfo(`[Database] Loaded ${migrations.length} migration(s) from disk`);
      return { migrations, source: "disk" as const };
    }

    yield* Effect.logWarning(
      `[Database] No migrations found from virtual or disk: ${diskResult.left.message}`,
    );
    return { migrations: [], source: "disk" as const };
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

function journalRef(s: MigrationStorage): ReturnType<typeof sql> {
  return sql.raw(`"${s.schema}"."${s.table}"`);
}

export function migrate(
  db: Database,
  migrations: Migration[],
  storage?: MigrationStorage,
): Effect.Effect<number, DatabaseError> {
  return Effect.gen(function* () {
    const sorted = [...migrations].sort((a, b) => a.idx - b.idx);
    const journal = storage ?? {
      schema: "drizzle",
      table: "__drizzle_migrations",
      slug: "default",
    };

    yield* ensureMigrationTable(db, journal);

    if (storage) {
      yield* importLegacyHashes(db, sorted, journal);
    }

    const ref = journalRef(journal);
    const rawResult = yield* Effect.tryPromise({
      try: () => db.execute(sql`SELECT hash FROM ${ref}`),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "read-applied", cause }),
    });
    const appliedHashes = new Set(normalizeRows<{ hash: string }>(rawResult).map((r) => r.hash));

    let applied = 0;
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
              sql`INSERT INTO ${ref} (hash, created_at) VALUES (${migration.hash}, ${migration.when})`,
            );
          }),
        catch: (cause) =>
          cause instanceof DatabaseError
            ? cause
            : new DatabaseError({ stage: "migration", migrationTag: migration.tag, cause }),
      });
      applied++;
    }

    return applied;
  });
}

function ensureMigrationTable(
  db: Database,
  storage: MigrationStorage,
): Effect.Effect<void, DatabaseError> {
  const ref = journalRef(storage);
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "init-schema", cause }),
    });

    yield* Effect.tryPromise({
      try: () =>
        db.execute(sql`
          CREATE TABLE IF NOT EXISTS ${ref} (
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

function importLegacyHashes(
  db: Database,
  localMigrations: Migration[],
  storage: MigrationStorage,
): Effect.Effect<void, DatabaseError> {
  return Effect.gen(function* () {
    const ref = journalRef(storage);

    const existingRaw = yield* Effect.tryPromise({
      try: () => db.execute(sql`SELECT count(*)::int AS cnt FROM ${ref}`),
      catch: () =>
        new DatabaseError({
          stage: "migration",
          migrationTag: "init-table",
          cause: new Error("Failed to check existing count"),
        }),
    }).pipe(Effect.catchAll(() => Effect.succeed({ rows: [{ cnt: 0 }] })));

    if ((normalizeRows<{ cnt: number }>(existingRaw)[0]?.cnt ?? 0) > 0) return;

    const localHashes = [...new Set(localMigrations.map((m) => m.hash))];
    if (localHashes.length === 0) return;

    for (const candidate of getLegacyCandidates()) {
      const candidateRef = sql.raw(`"${candidate.schema}"."${candidate.table}"`);

      const legacyResult = yield* Effect.tryPromise({
        try: () =>
          db.execute(sql`
            SELECT hash, created_at FROM ${candidateRef}
            WHERE hash = ANY(${localHashes})
          `),
        catch: () =>
          new DatabaseError({
            stage: "migration",
            migrationTag: "legacy-import",
            cause: new Error("Legacy import query failed"),
          }),
      }).pipe(Effect.catchAll(() => Effect.succeed(null)));

      if (!legacyResult) continue;
      const rows = normalizeRows<{ hash: string; created_at: number }>(legacyResult);
      if (rows.length === 0) continue;

      const imported = rows.filter((r) => r.hash && r.created_at);
      if (imported.length === 0) continue;

      yield* Effect.logInfo(
        `[Database] Importing ${imported.length} legacy migration hash(es) from ${candidate.schema}.${candidate.table}`,
      );

      for (const row of imported) {
        yield* Effect.tryPromise({
          try: () =>
            db.execute(sql`
              INSERT INTO ${ref} (hash, created_at)
              SELECT ${row.hash}::text, ${row.created_at}::bigint
              WHERE NOT EXISTS (
                SELECT 1 FROM ${ref} WHERE hash = ${row.hash}
              )
            `),
          catch: () =>
            new DatabaseError({
              stage: "migration",
              migrationTag: "legacy-import",
              cause: new Error("Legacy row import failed"),
            }),
        }).pipe(Effect.ignore);
      }
    }
  });
}

export function detectDrift(
  db: Database,
  migrations: Migration[],
  storage?: MigrationStorage,
): Effect.Effect<DriftReport, DatabaseError> {
  return Effect.gen(function* () {
    const journal = storage ?? getMigrationStorage();
    const expectedTables = extractExpectedTables(migrations);
    const ref = journalRef(journal);

    const rawResult = yield* Effect.tryPromise({
      try: () => db.execute(sql`SELECT hash FROM ${ref}`),
      catch: () =>
        new DatabaseError({
          stage: "migration",
          migrationTag: "drift-check",
          cause: new Error("Failed to read applied hashes"),
        }),
    }).pipe(Effect.catchAll(() => Effect.succeed({ rows: [] })));
    const appliedHashes = normalizeRows<{ hash: string }>(rawResult);
    const appliedCount = appliedHashes.length;

    if (expectedTables.length === 0) {
      return {
        status: "empty",
        expectedTables: [],
        missingTables: [],
        appliedHashes: appliedCount,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    if (appliedCount === 0) {
      const hasLegacy = yield* checkLegacyHasMatchingHashes(db, migrations);
      return {
        status: hasLegacy ? "legacy-importable" : "healthy",
        expectedTables,
        missingTables: expectedTables,
        appliedHashes: 0,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    const tableResult = yield* Effect.tryPromise({
      try: () =>
        db.execute(sql`
          SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ANY(${expectedTables})
        `),
      catch: () =>
        new DatabaseError({
          stage: "migration",
          migrationTag: "drift-check-tables",
          cause: new Error("Failed to check expected tables"),
        }),
    }).pipe(Effect.catchAll(() => Effect.succeed({ rows: [] })));

    const existingTables = new Set(
      normalizeRows<{ table_name: string }>(tableResult).map((r) => r.table_name),
    );

    const missingTables = expectedTables.filter((t) => !existingTables.has(t));

    if (missingTables.length === 0) {
      return {
        status: "healthy",
        expectedTables,
        missingTables: [],
        appliedHashes: appliedCount,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    if (missingTables.length === expectedTables.length) {
      return {
        status: "drift-safe-repair",
        expectedTables,
        missingTables,
        appliedHashes: appliedCount,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    return {
      status: "drift-manual",
      expectedTables,
      missingTables,
      appliedHashes: appliedCount,
      localHashes: migrations.length,
      storage: journal,
    };
  });
}

function checkLegacyHasMatchingHashes(
  db: Database,
  migrations: Migration[],
): Effect.Effect<boolean, never> {
  return Effect.gen(function* () {
    const localHashes = [...new Set(migrations.map((m) => m.hash))];
    if (localHashes.length === 0) return false;

    for (const candidate of getLegacyCandidates()) {
      const ref = sql.raw(`"${candidate.schema}"."${candidate.table}"`);
      const result = yield* Effect.tryPromise({
        try: () =>
          db.execute(sql`
            SELECT count(*)::int AS cnt FROM ${ref}
            WHERE hash = ANY(${localHashes})
          `),
        catch: () =>
          new DatabaseError({
            stage: "migration",
            migrationTag: "legacy-check",
            cause: new Error("Legacy hash check failed"),
          }),
      }).pipe(Effect.catchAll(() => Effect.succeed(null)));

      if (!result) continue;
      const cnt = normalizeRows<{ cnt: number }>(result)[0]?.cnt ?? 0;
      if (cnt > 0) return true;
    }

    return false;
  });
}
