import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient, AuthClient } from "@/app";
import { ensureNearProfiles } from "@/lib/queries/builders";

export const PAGE_SIZE = 24;

export type ActivityFeedPage = Awaited<ReturnType<ApiClient["getActivityFeed"]>>;
export type ActivityEvent = ActivityFeedPage["data"][number];
export type ActivityFilters = Omit<
  NonNullable<Parameters<ApiClient["getActivityFeed"]>[0]>,
  "cursor"
>;

export interface ActivityPayload {
  title?: string;
  description?: string;
  mediaUrl?: string;
  tags?: string[];
}

export type LeaderboardEntry = Awaited<ReturnType<ApiClient["getLeaderboard"]>>[number];
export type LeaderboardPeriod = NonNullable<Parameters<ApiClient["getLeaderboard"]>[0]>["period"];

// The leaderboard endpoint only accepts `period` + `limit` (max 100), so we fetch
// the cap once and paginate client-side at LEADERBOARD_PAGE_SIZE per page.
export const LEADERBOARD_PAGE_SIZE = 50;
const LEADERBOARD_FETCH_LIMIT = 100;

export const activityKeys = {
  feed: (filters: ActivityFilters = {}) =>
    [
      "activity",
      "feed",
      filters.source ?? null,
      filters.type ?? null,
      filters.actor ?? null,
    ] as const,
  leaderboard: (period: LeaderboardPeriod) => ["activity", "leaderboard", period] as const,
};

export function leaderboardQueryOptions(apiClient: ApiClient, period: LeaderboardPeriod) {
  return {
    queryKey: activityKeys.leaderboard(period),
    queryFn: () => apiClient.getLeaderboard({ period, limit: LEADERBOARD_FETCH_LIMIT }),
    staleTime: 30_000,
  };
}

export function readActivityPayload(payload: unknown): ActivityPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const record = payload as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title : undefined;
  const description = typeof record.description === "string" ? record.description : undefined;
  const mediaUrl = typeof record.mediaUrl === "string" ? record.mediaUrl : undefined;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;
  return { title, description, mediaUrl, tags };
}

export function activityFeedQueryOptions(apiClient: ApiClient, filters: ActivityFilters = {}) {
  const { source, type, actor, limit = PAGE_SIZE } = filters;
  return {
    queryKey: activityKeys.feed({ source, type, actor }),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.getActivityFeed({
        source: source || undefined,
        type: type || undefined,
        actor: actor || undefined,
        limit,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ActivityFeedPage) =>
      lastPage.meta.hasMore ? (lastPage.meta.nextCursor ?? undefined) : undefined,
  };
}

export function activityFeedWithProfilesQueryOptions(
  apiClient: ApiClient,
  authClient: AuthClient,
  queryClient: QueryClient,
  filters: ActivityFilters = {},
) {
  const options = activityFeedQueryOptions(apiClient, filters);
  return {
    ...options,
    queryFn: async (context: { pageParam: string | undefined }) => {
      const page = await options.queryFn(context);
      await ensureNearProfiles(
        queryClient,
        authClient,
        page.data.map((event) => event.actor),
      );
      return page;
    },
  };
}
