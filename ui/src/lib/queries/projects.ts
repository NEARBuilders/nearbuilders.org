import type { ApiClient } from "@/app";

export const PAGE_SIZE = 24;

type ListProjectsInput = Parameters<ApiClient["listProjects"]>[0];

export type ProjectListFilters = {
  kind?: ListProjectsInput["kind"];
  ownerId?: string;
  privateOnly?: boolean;
  query?: string;
  status?: ListProjectsInput["status"];
  sort: "newest" | "oldest";
};

type PageMeta = { meta: { hasMore: boolean; nextCursor: string | null } };

function getNextPageParam(lastPage: PageMeta) {
  return lastPage.meta.hasMore ? (lastPage.meta.nextCursor ?? undefined) : undefined;
}

export function projectsInfiniteOptions(
  apiClient: ApiClient,
  filters: ProjectListFilters,
  limit: number = PAGE_SIZE,
) {
  return {
    queryKey: [
      "projects",
      filters.kind ?? "all",
      filters.ownerId ?? null,
      Boolean(filters.privateOnly),
      filters.query ?? null,
      filters.status ?? null,
      filters.sort,
    ] as const,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.listProjects({
        limit,
        cursor: pageParam,
        kind: filters.kind,
        ownerId: filters.ownerId,
        visibility: filters.privateOnly ? "private" : undefined,
        query: filters.query,
        status: filters.status,
        sort: filters.sort,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam,
  };
}

export function claimedCatalogProjectsInfiniteOptions(
  apiClient: ApiClient,
  filters: { nearAccount?: string; query?: string },
  limit: number = PAGE_SIZE,
) {
  return {
    queryKey: ["catalog-projects", filters.nearAccount ?? null, filters.query ?? null] as const,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiClient.listClaimedCatalogProjects({
        nearAccount: filters.nearAccount,
        query: filters.query,
        limit,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam,
  };
}

export function flattenUniquePages<T>(
  pages: Array<{ data: T[] }> | undefined,
  getId: (item: T) => string,
): T[] {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const page of pages ?? []) {
    for (const item of page.data) {
      const id = getId(item);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
  }
  return items;
}
