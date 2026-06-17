import { Context, Effect, Layer } from "every-plugin/effect";
import type { ProjectsDatabase } from "./index";
import { migrate } from "./migrator";

export const DatabaseTag = Context.Tag("projects/Database")<ProjectsDatabase, ProjectsDatabase>();

export const DatabaseLive = (url: string) =>
  Layer.scoped(
    DatabaseTag,
    Effect.acquireRelease(
      Effect.promise(async () => {
        console.log("[Projects] Initializing database...");

        try {
          const { createDatabaseDriver } = await import("./index");
          const driver = await createDatabaseDriver(url);

          const migrations = await import("virtual:drizzle-migrations.sql");
          await migrate(driver.db, migrations.default);
          console.log("[Projects] Migrations applied");

          return driver.db;
        } catch (error) {
          console.error(
            "[Projects] Database initialization failed:",
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      }),
      () => Effect.void,
    ),
  );
