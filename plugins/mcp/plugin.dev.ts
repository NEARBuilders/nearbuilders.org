import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3018,
  config: {
    variables: {
      MCP_PLUGIN_REGISTRY_URL: process.env.MCP_PLUGIN_REGISTRY_URL || "http://localhost:3000",
    },
    secrets: {},
  } satisfies PluginConfigInput<typeof Plugin>,
};
