import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3011,
  config: {
    variables: {
      nominationJoinBaseUrl: "https://nearbuilders.org",
    },
    secrets: {
      BUILDERS_DATABASE_URL: process.env.BUILDERS_DATABASE_URL || "pglite:.bos/builders/:memory:",
      NOMINATION_TOKEN_SECRET:
        process.env.NOMINATION_TOKEN_SECRET || "development-only-nomination-token-secret",
      TELEGRAM_BOT_API_KEY_ID: process.env.TELEGRAM_BOT_API_KEY_ID || "telegram-bot-key",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
