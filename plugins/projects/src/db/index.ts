import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type ProjectsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseDriver {
  readonly db: ProjectsDatabase;
  close(): Promise<void>;
}

export async function createDatabaseDriver(url: string): Promise<DatabaseDriver> {
  if (url.startsWith("pglite:") || url === ":memory:") {
    const { drizzle } = await import("drizzle-orm/pglite");
    const rawDir = url === ":memory:" ? ":memory:" : url.replace("pglite:", "");
    const dataDir = rawDir.endsWith("/:memory:") || rawDir === ":memory:" ? ":memory:" : rawDir;
    if (dataDir !== ":memory:") {
      mkdirSync(dirname(dataDir), { recursive: true });
    }
    const db = drizzle(dataDir, { schema });
    return {
      db,
      close: async () => {},
    };
  }

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({
    connectionString: url,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("[Projects] Database connection verified");
  } catch (err) {
    pool.end().catch(() => {});
    throw new Error(
      `[Projects] Database connection failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    db: drizzle(pool, { schema }),
    close: async () => {
      await pool.end();
    },
  };
}
