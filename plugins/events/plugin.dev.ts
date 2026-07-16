import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3015,
  config: {
    variables: {},
    secrets: {
      EVENTS_DATABASE_URL: process.env.EVENTS_DATABASE_URL || "pglite:.bos/events/:memory:",
      LUMA_CALENDAR_API_KEYS: process.env.LUMA_CALENDAR_API_KEYS || "[]",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
