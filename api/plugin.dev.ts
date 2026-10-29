/**
 * FRAMEWORK-OWNED — reconciled from the parent template by `bos upgrade`.
 * Local edits are allowed: on the next upgrade the template version wins and your
 * copy is backed up under `.bos/sync-backup/`. To make a change permanent, file an
 * issue: https://github.com/NEARBuilders/everything-dev/issues
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

/**
 * The api shell's dev root secret — per-run when the operator supplies none
 * (zero-config dev, plan 055 ticket 11). Exported for the test harness so it
 * can derive the same KEK.
 */
export const devAuthSecret =
  process.env.BETTER_AUTH_SECRET || randomBytes(32).toString("base64url");

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3001,
  config: {
    // child-owned-start
    variables: {},
    // child-owned-end
    secrets: {
      API_DATABASE_URL: process.env.API_DATABASE_URL || "pglite:.bos/api/:memory:",
      REQUIRE_ADMIN_APPROVAL: process.env.REQUIRE_ADMIN_APPROVAL || "",
      BETTER_AUTH_SECRET: devAuthSecret,
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
