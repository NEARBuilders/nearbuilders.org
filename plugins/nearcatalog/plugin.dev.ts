import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3017,
  config: {
    variables: {
      baseUrl: process.env.NEARCATALOG_BASE_URL || "https://api.nearcatalog.xyz",
    },
    secrets: {
      NEARCATALOG_DATABASE_URL:
        process.env.NEARCATALOG_DATABASE_URL || "pglite:.bos/nearcatalog/:memory:",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
