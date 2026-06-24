import type { ApiClient } from "@/app";

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

export const activityKeys = {
  feed: (filters: ActivityFilters = {}) =>
    [
      "activity",
      "feed",
      filters.source ?? null,
      filters.type ?? null,
      filters.actor ?? null,
    ] as const,
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
