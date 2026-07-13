import type { ApiClient } from "@/app";

export type ClaimedCatalogProject = Awaited<
  ReturnType<ApiClient["listClaimedCatalogProjects"]>
>["data"][number];

export const catalogKeys = {
  claimedProjects: (nearAccount?: string) =>
    ["catalog-claims", "projects", nearAccount?.toLowerCase() ?? null] as const,
};

export function claimedCatalogProjectsQueryOptions(apiClient: ApiClient, nearAccount?: string) {
  return {
    queryKey: catalogKeys.claimedProjects(nearAccount),
    queryFn: () => apiClient.listClaimedCatalogProjects({ nearAccount, limit: 100 }),
    staleTime: 60_000,
  };
}
