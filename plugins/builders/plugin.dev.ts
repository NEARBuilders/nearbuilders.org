import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3011,
  config: {
    variables: {},
    secrets: {
      BUILDERS_DATABASE_URL: process.env.BUILDERS_DATABASE_URL || "pglite:.bos/builders/:memory:",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
