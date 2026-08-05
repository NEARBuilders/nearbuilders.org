import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3019,
  config: {
    variables: {},
    secrets: {
      FEEDBACK_DATABASE_URL: process.env.FEEDBACK_DATABASE_URL || "pglite:.bos/feedback/:memory:",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
