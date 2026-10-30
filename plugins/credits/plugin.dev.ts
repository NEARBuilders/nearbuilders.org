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
      CREDITS_DATABASE_URL: process.env.CREDITS_DATABASE_URL || "pglite:.bos/credits/:memory:",
      CREDITS_ENABLED: process.env.CREDITS_ENABLED || "",
      CREDITS_AMOUNT_USD: process.env.CREDITS_AMOUNT_USD || "",
      CREDITS_CLAIMS_CLOSE_AT: process.env.CREDITS_CLAIMS_CLOSE_AT || "",
      CREDITS_KEY_EXPIRES_AT: process.env.CREDITS_KEY_EXPIRES_AT || "",
      NEARAI_CREDITS_REFRESH_TOKEN: process.env.NEARAI_CREDITS_REFRESH_TOKEN || "",
      NEARAI_CREDITS_USER_AGENT: process.env.NEARAI_CREDITS_USER_AGENT || "",
      NEARAI_CREDITS_WORKSPACE_ID: process.env.NEARAI_CREDITS_WORKSPACE_ID || "",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
