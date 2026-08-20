import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Data } from "every-plugin/effect";
import type { PoolConfig } from "pg";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseDriver {
  readonly db: Database;
  close(): Promise<void>;
}

interface PoolLike {
  on(event: "error", listener: (err: Error) => void): this;
  on(
    event: "connect",
    listener: (client: { query: (sql: string) => Promise<unknown> }) => void,
  ): this;
  removeAllListeners(event?: string | symbol): this;
  end(): Promise<void>;
}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  stage: "driver" | "migration" | "load" | "close";
  migrationTag?: string;
  statementIndex?: number;
  cause: unknown;
}> {
  override get message() {
    const parts = [`DatabaseError [stage=${this.stage}]`];
    if (this.migrationTag) parts.push(`migration=${this.migrationTag}`);
    if (this.statementIndex !== undefined) parts.push(`statement=${this.statementIndex}`);
    parts.push(unwrapDatabaseError(this.cause));
    return parts.join(": ");
  }
}

export function unwrapDatabaseError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts = [error.message];
  let cause: unknown = error.cause;
  while (cause instanceof Error) {
    parts.push(cause.message);
    cause = cause.cause;
  }
  return parts.join(": ");
}

function buildPoolConfig(url: string): PoolConfig {
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  return {
    connectionString: url,
    ssl: isLocal
      ? false
      : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" },
    max: Number(process.env.DB_POOL_MAX) || 10,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 30_000,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30_000,
  };
}

function attachPoolSchemaHandlers(pool: PoolLike, schemaName: string | undefined): void {
  pool.on("error", (err: Error) => {
    console.error("[Database] Unexpected pool error:", err.message);
  });
  if (schemaName) {
    pool.on("connect", (client) => {
      client
        .query(
          `CREATE SCHEMA IF NOT EXISTS "${schemaName}"; SET search_path TO "${schemaName}", public`,
        )
        .catch((err: Error) => console.error("[Database] Schema init failed:", err.message));
    });
  }
}

function createCloseHandler(pool: PoolLike): () => Promise<void> {
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    pool.removeAllListeners("error");
    pool.removeAllListeners("connect");
    await pool.end();
  };
}

export async function createDatabaseDriver(
  url: string,
  schemaName?: string,
): Promise<DatabaseDriver> {
  if (url.startsWith("pglite:") || url === ":memory:") {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { PGlite } = await import("@electric-sql/pglite");
    const rawDir = url === ":memory:" ? ":memory:" : url.replace("pglite:", "");
    const dataDir = rawDir.endsWith("/:memory:") || rawDir === ":memory:" ? "memory://" : rawDir;
    if (dataDir !== "memory://") {
      mkdirSync(dirname(dataDir), { recursive: true });
    }
    const pglite = new PGlite(dataDir);
    if (schemaName) {
      await pglite.exec(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await pglite.exec(`SET search_path TO "${schemaName}", public`);
    }
    const db = drizzle(pglite, { schema });
    return {
      db,
      close: async () => {
        await pglite.close();
      },
    };
  }

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pool = new Pool(buildPoolConfig(url));
  attachPoolSchemaHandlers(pool, schemaName);
  return {
    db: drizzle(pool, { schema }),
    close: createCloseHandler(pool),
  };
}
