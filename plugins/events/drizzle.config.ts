/**
 * FRAMEWORK-OWNED — reconciled from the parent template by `bos upgrade`.
 * Local edits are allowed: on the next upgrade the template version wins and your
 * copy is backed up under `.bos/sync-backup/`. To make a change permanent, file an
 * issue: https://github.com/NEARBuilders/everything-dev/issues
 */
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl, workspaceIdentityFromModuleUrl } from "everything-dev/db";

const identity = workspaceIdentityFromModuleUrl(import.meta.url);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(identity),
  },
  migrations: {
    schema: identity.journal.schema,
    table: identity.journal.table,
  },
  verbose: true,
  strict: true,
});
