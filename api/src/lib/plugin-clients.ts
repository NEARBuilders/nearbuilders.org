import type { PluginsClient as PluginEntries } from "./plugins-types.gen";

export type { PluginEntries };

export type PluginsClient = {
  [K in keyof PluginEntries]: (context?: object) => ReturnType<PluginEntries[K]["client"]>;
};

export function toPluginsClient(entries: PluginEntries): PluginsClient {
  return Object.fromEntries(
    Object.entries(entries).map(([key, entry]) => [
      key,
      (context?: object) => entry.client(context as Record<string, unknown> | undefined),
    ]),
  ) as PluginsClient;
}
