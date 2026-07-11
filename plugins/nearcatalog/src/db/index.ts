import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { drizzle as createPostgresDatabase } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as createPgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type NearCatalogDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseDriver {
  readonly db: NearCatalogDatabase;
  close(): Promise<void>;
}

export async function createDatabaseDriver(url: string): Promise<DatabaseDriver> {
  if (url.startsWith("pglite:") || url === ":memory:") {
    const rawDir = url === ":memory:" ? ":memory:" : url.replace("pglite:", "");
    const dataDir = rawDir.endsWith("/:memory:") || rawDir === ":memory:" ? ":memory:" : rawDir;
    if (dataDir !== ":memory:") {
      mkdirSync(dirname(dataDir), { recursive: true });
    }
    const db = createPgliteDatabase(dataDir, { schema });
    return {
      db,
      close: async () => {
        await db.$client.close();
      },
    };
  }

  const pool = new Pool({
    connectionString: url,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });
  return {
    db: createPostgresDatabase(pool, { schema }),
    close: async () => {
      await pool.end();
    },
  };
}
