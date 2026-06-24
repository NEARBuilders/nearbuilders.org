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

export interface ActivityFilters {
  source?: string;
  type?: string;
  actor?: string;
  limit?: number;
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
