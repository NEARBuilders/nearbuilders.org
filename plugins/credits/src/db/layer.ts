import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Effect } from "effect";
import { Context } from "effect";
import {
  type DatabaseError,
  databaseLayer,
  type LoadedMigrations,
  loadMigrations as loadSharedMigrations,
} from "everything-dev/db";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export class DatabaseTag extends Context.Service<DatabaseTag, Database>()("credits/Database") {}

const loadMigrations: Effect.Effect<LoadedMigrations, DatabaseError> = loadSharedMigrations({
  fromDir: import.meta.dirname,
  virtual: () => import("virtual:drizzle-migrations.sql"),
});

export const DatabaseLive = (config: {
  pluginId: string;
  secrets: { CREDITS_DATABASE_URL: string };
}) =>
  databaseLayer(DatabaseTag, config.secrets.CREDITS_DATABASE_URL, {
    pluginId: config.pluginId,
    schema,
    migrations: loadMigrations,
  });
