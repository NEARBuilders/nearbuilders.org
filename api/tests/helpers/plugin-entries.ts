export function asPluginEntries(factories: Record<string, (...args: never[]) => unknown>) {
  return Object.fromEntries(Object.entries(factories).map(([key, client]) => [key, { client }]));
}
