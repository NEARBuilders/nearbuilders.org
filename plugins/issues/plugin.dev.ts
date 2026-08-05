import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3018,
  config: {
    variables: {
      repos: process.env.ISSUES_REPOS || "NEARBuilders/nearbuilders.org",
      claimTtlDays: Number(process.env.ISSUES_CLAIM_TTL_DAYS) || 7,
    },
    secrets: {
      ISSUES_DATABASE_URL: process.env.ISSUES_DATABASE_URL || "pglite:.bos/issues/:memory:",
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
