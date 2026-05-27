import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.BUILDERS_DATABASE_URL || "pglite:.bos/builders/:memory:",
  },
  verbose: true,
  strict: true,
});
