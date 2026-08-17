import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3018,
  config: {
    variables: {
      STANDARD_RELAYS: process.env.STANDARD_RELAYS || "wss://nos.lol,wss://relay.damus.io,wss://relay.primal.net",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
