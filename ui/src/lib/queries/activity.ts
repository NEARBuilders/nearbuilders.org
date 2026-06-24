import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const PAGE_SIZE = 24;

export interface ActivityEvent {
  id: string;
  source: string;
  type: string;
  actor: string;
  payload: unknown;
  verified: boolean;
  createdAt: string;
}

export interface ActivityFeedPage {
  data: ActivityEvent[];
  meta: { total: number; hasMore: boolean; nextCursor: string | null };
}

export interface ActivityPayload {
  title?: string;
  description?: string;
  mediaUrl?: string;
  tags?: string[];
}

export interface LeaderboardEntry {
  actor: string;
  eventCount: number;
  endorsementScore: number;
  topSources: string[];
}

export type LeaderboardPeriod = "week" | "month" | "all-time";

export interface ActivityFilters {
  source?: string;
  type?: string;
  actor?: string;
  limit?: number;
}

export const activityKeys = {
  all: ["activity"] as const,
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

export function leaderboardQueryOptions(
  apiClient: ApiClient,
  options: { period: LeaderboardPeriod; limit?: number },
) {
  return {
    queryKey: activityKeys.leaderboard(options.period),
    queryFn: () => apiClient.getLeaderboard({ period: options.period, limit: options.limit }),
    staleTime: 60_000,
  };
}

export function emitActivityMutationOptions(apiClient: ApiClient, queryClient: QueryClient) {
  return {
    mutationFn: (input: {
      source: string;
      type: string;
      actor: string;
      payload: unknown;
      verified?: boolean;
    }) => apiClient.emitActivity(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: activityKeys.all });
    },
  };
}
