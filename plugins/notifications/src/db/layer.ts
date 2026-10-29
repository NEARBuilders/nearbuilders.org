import { Context, Effect, Layer } from "effect";
import { PluginIdTag } from "every-plugin";
import { getMigrationStorage, pluginMigrationSlug } from "everything-dev/db";
import { createDatabaseDriver, type Database, DatabaseError } from "./index";
import { detectDrift, loadMigrations, migrate } from "./migrate";

export class DatabaseTag extends Context.Service<DatabaseTag, Database>()("Database") {}

export const DatabaseLive = (url: string) =>
  Layer.effect(
    DatabaseTag,
    Effect.gen(function* () {
      const pluginId = yield* PluginIdTag;
      const slug = pluginMigrationSlug(pluginId);
      // The api keeps the public-schema topology (what `bos db doctor` checks,
      // the drizzle-kit config targets, and every v1-upgraded database already
      // has); plugins scope into plugin_<slug> on the shared database.
      const schemaName = slug === "api" ? undefined : `plugin_${slug}`;

      const driver = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => createDatabaseDriver(url, schemaName),
          catch: (cause) => new DatabaseError({ stage: "driver", cause }),
        }),
        (driver) =>
          Effect.tryPromise({
            try: () => driver.close(),
            catch: (cause) => new DatabaseError({ stage: "close", cause }),
          }).pipe(Effect.ignore),
      );

      const storage = getMigrationStorage(slug);
      const { migrations, source } = yield* loadMigrations;

      if (migrations.length === 0) {
        yield* Effect.logWarning(
          `[Database] No migrations found (source: ${source}) — schema may be missing`,
        );
      } else {
        const applied = yield* migrate(driver.db, migrations, storage, schemaName);

        if (applied === 0) {
          yield* Effect.logInfo(
            `[Database] Schema up to date (0 migrations needed, source: ${source})`,
          );
        } else {
          yield* Effect.logInfo(
            `[Database] Applied ${applied}/${migrations.length} migration(s) (source: ${source}, journal: ${storage.schema}.${storage.table}, schema: ${schemaName ?? "public"})`,
          );
        }

        const drift = yield* detectDrift(driver.db, migrations, storage, schemaName);
        if (drift.status === "healthy" || drift.status === "untracked-existing-schema") {
          yield* Effect.logInfo(`[Database] Ready`);
        } else if (drift.status === "drift-safe-repair") {
          yield* Effect.logWarning(
            `[Database] ⚠️ Migration drift detected: ${drift.missingTables.length} expected table(s) missing: ${drift.missingTables.join(", ")}`,
          );
          yield* Effect.logWarning(
            `[Database] Run \`bos db doctor ${storage.slug}\` to diagnose and \`bos db repair ${storage.slug}\` to fix.`,
          );
          return yield* new DatabaseError({
            stage: "migration",
            migrationTag: "drift-safe-repair",
            cause: new Error(
              `Migration journal has ${drift.appliedHashes} applied hashes but all ${drift.expectedTables.length} expected table(s) are missing. ` +
                `Run \`bos db repair ${storage.slug}\` to reset the migration history and reapply migrations. ` +
                `Missing tables: ${drift.missingTables.join(", ")}`,
            ),
          });
        }
        if (drift.status === "drift-manual") {
          yield* Effect.logWarning(
            `[Database] ⚠️ Partial migration drift detected: ${drift.missingTables.length}/${drift.expectedTables.length} expected table(s) missing.`,
          );
          return yield* new DatabaseError({
            stage: "migration",
            migrationTag: "drift-manual",
            cause: new Error(
              `Partial schema drift — ${drift.missingTables.length}/${drift.expectedTables.length} expected table(s) are missing. ` +
                `Run \`bos db doctor ${storage.slug}\` for details. Manual intervention required. ` +
                `Missing tables: ${drift.missingTables.join(", ")}`,
            ),
          });
        }
      }

      return driver.db;
    }),
  );
