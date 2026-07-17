import { Context, Effect, Layer } from "every-plugin/effect";
import { createDatabaseDriver, type Database, DatabaseError } from "./index";
import { loadMigrations, migrate } from "./migrate";

export class DatabaseTag extends Context.Tag("Database")<Database, Database>() {}

export const DatabaseLive = (url: string) =>
  Layer.scoped(
    DatabaseTag,
    Effect.gen(function* () {
      const driver = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => createDatabaseDriver(url),
          catch: (cause) => new DatabaseError({ stage: "driver", cause }),
        }),
        (driver) =>
          Effect.tryPromise({
            try: () => driver.close(),
            catch: (cause) => new DatabaseError({ stage: "close", cause }),
          }).pipe(Effect.ignore),
      );

      const migrations = yield* loadMigrations();
      yield* migrate(driver.db, migrations);

      yield* Effect.logInfo("[Database] Migrations applied");

      return driver.db;
    }),
  );
