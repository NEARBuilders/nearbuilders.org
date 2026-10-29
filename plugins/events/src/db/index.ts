import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createDatabaseDriver as createSharedDriver } from "everything-dev/db";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export { DatabaseError, unwrapDatabaseError } from "everything-dev/db";

export interface DatabaseDriver {
  readonly db: Database;
  close(): Promise<void>;
}

/**
 * Thin adapter over the shared `createDatabaseDriver` (`everything-dev/db`).
 *
 * This file is sync-owned: `bos sync` copies it verbatim into every plugin's
 * `src/db/index.ts`, so it must stay workspace-agnostic — the plugin's own
 * schema module arrives via the relative `./schema` import. Engine selection
 * (`pglite:` / `:memory:` → PGlite, else postgres), protocol-level
 * `search_path`, one-time schema creation, env-driven pool config, and the
 * idempotent close handler all live in the shared driver.
 */
export async function createDatabaseDriver(
  url: string,
  schemaName?: string,
): Promise<DatabaseDriver> {
  return createSharedDriver(url, schema, schemaName);
}
