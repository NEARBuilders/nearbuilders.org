import { Context, Effect, Layer } from "every-plugin/effect";
import { createDatabaseDriver, type DatabaseDriver, DatabaseError } from "./index";
import { loadMigrations, migrate } from "./migrate";

export class DatabaseTag extends Context.Tag("api/Database")<DatabaseDriver, DatabaseDriver>() {}

export const DatabaseLive = (url: string) =>
  Layer.scoped(
    DatabaseTag,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const driver = yield* Effect.tryPromise({
          try: () => createDatabaseDriver(url),
          catch: (cause) => new DatabaseError({ stage: "driver", cause }),
        });

        const migrations = yield* loadMigrations();
        yield* migrate(driver.db, migrations);

        yield* Effect.logInfo("[Database] Migrations applied");

        return driver;
      }),
      (driver) =>
        Effect.tryPromise({
          try: () => driver.close(),
          catch: (cause) => new DatabaseError({ stage: "close", cause }),
        }).pipe(Effect.ignore),
    ),
  );
