import type { ApiClient } from "@/app";

export type PublicCatalogListing = Awaited<
  ReturnType<ApiClient["listCatalogListings"]>
>["data"][number];

export const catalogListingsQueryOptions = (
  apiClient: Pick<ApiClient, "listCatalogListings">,
  kind: "project" | "person",
) => ({
  queryKey: ["catalog-listings", kind] as const,
  queryFn: async () => (await apiClient.listCatalogListings({ kind })).data,
  staleTime: 5 * 60_000,
});

export function findCatalogListing(
  listings: PublicCatalogListing[] | undefined,
  entityId: string | null | undefined,
) {
  if (!listings || !entityId) return null;
  const id = entityId.toLowerCase();
  return listings.find((listing) => listing.entityId.toLowerCase() === id) ?? null;
}

export type CatalogListingTarget =
  | { kind: "project"; projectId: string }
  | { kind: "person"; projectId?: undefined };

export function catalogListingQueryKey(target: CatalogListingTarget) {
  return ["catalog-listing", target.kind, target.projectId ?? "me"] as const;
}
