import { defineConfig } from "drizzle-kit";
import { getMigrationStorage } from "everything-dev/db";

const storage = getMigrationStorage();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.API_DATABASE_URL || "pglite:.bos/api/:memory:",
  },
  migrations: {
    schema: storage.schema,
    table: storage.table,
  },
  verbose: true,
  strict: true,
});
