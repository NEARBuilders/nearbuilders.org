import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEARCATALOG_DATABASE_URL || "pglite:.bos/nearcatalog/:memory:",
  },
  verbose: true,
  strict: true,
});
