import type { QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

type CatalogProjectApiClient = Pick<ApiClient, "getCatalogProject">;
type CatalogClaimApiClient = Pick<ApiClient, "getCatalogProject" | "getMyCatalogClaimProposals">;

export type ClaimedCatalogProject = Awaited<
  ReturnType<ApiClient["listClaimedCatalogProjects"]>
>["data"][number];
export type CatalogClaimProposal = Awaited<
  ReturnType<ApiClient["getMyCatalogClaimProposals"]>
>["data"][number];

export const catalogKeys = {
  project: (slug: string) => ["catalog-project", slug] as const,
  claimProposals: ["catalog-claim-proposals"] as const,
  claimedProjects: (nearAccount?: string) =>
    ["catalog-claims", "projects", nearAccount?.toLowerCase() ?? null] as const,
};

export function catalogProjectQueryOptions(apiClient: CatalogProjectApiClient, slug: string) {
  return {
    queryKey: catalogKeys.project(slug),
    queryFn: () => apiClient.getCatalogProject({ slug }),
    staleTime: 5 * 60_000,
    retry: false,
  };
}

export async function ensureCatalogProjects(
  queryClient: QueryClient,
  apiClient: CatalogProjectApiClient,
  slugs: Array<string | null | undefined>,
) {
  const uniqueSlugs = Array.from(new Set(slugs.filter((slug): slug is string => Boolean(slug))));
  await Promise.allSettled(
    uniqueSlugs.map((slug) =>
      queryClient.ensureQueryData(catalogProjectQueryOptions(apiClient, slug)),
    ),
  );
}

export function catalogClaimProposalsQueryOptions(
  apiClient: CatalogClaimApiClient,
  queryClient: QueryClient,
) {
  return {
    queryKey: catalogKeys.claimProposals,
    queryFn: async () => {
      const result = await apiClient.getMyCatalogClaimProposals();
      await ensureCatalogProjects(
        queryClient,
        apiClient,
        result.data.map((proposal) => proposal.projectSlug),
      );
      return result;
    },
  };
}

export function claimedCatalogProjectsQueryOptions(apiClient: ApiClient, nearAccount?: string) {
  return {
    queryKey: catalogKeys.claimedProjects(nearAccount),
    queryFn: () => apiClient.listClaimedCatalogProjects({ nearAccount, limit: 100 }),
    staleTime: 60_000,
  };
}
