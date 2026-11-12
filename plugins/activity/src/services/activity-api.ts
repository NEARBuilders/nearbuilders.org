import { COMMON_ERROR_STATUS_MAP, createORPCClient, ORPCError, ResponseError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { PluginsClient } from "../lib/plugins-client.gen";

export type ActivityApiClient = ReturnType<PluginsClient["activityApi"]["client"]>;

export type ActivityApiEvent = Awaited<
  ReturnType<ActivityApiClient["listActivityEvents"]>
>["data"][number];

export type ActivityApiLeaderboardEntry = Awaited<
  ReturnType<ActivityApiClient["getActivityLeaderboard"]>
>["data"][number];

export function activitySiteUrl(gatewayUrl: string): string {
  return gatewayUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

export function createActivitySourceClient(options: {
  baseUrl: string;
  apiKey: string;
  fetchImplementation?: typeof fetch;
}): ActivityApiClient {
  const fetchImplementation = options.fetchImplementation ?? globalThis.fetch;
  return createORPCClient<ActivityApiClient>(
    new RPCLink({
      origin: activitySiteUrl(options.baseUrl),
      url: "/api/rpc",
      headers: { authorization: `Bearer ${options.apiKey}` },
      fetch: (url, init) => fetchImplementation(url, init),
    }),
  );
}

export function activityErrorStatus(error: unknown): number | null {
  if (error instanceof ORPCError) {
    return (COMMON_ERROR_STATUS_MAP as Record<string, number>)[error.code] ?? 500;
  }
  if (error instanceof ResponseError) return error.response.status;
  return null;
}
