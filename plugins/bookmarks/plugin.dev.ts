import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3018,
  config: {
    variables: {},
    secrets: {
      BOOKMARKS_DATABASE_URL:
        process.env.BOOKMARKS_DATABASE_URL || "pglite:.bos/bookmarks/:memory:",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
