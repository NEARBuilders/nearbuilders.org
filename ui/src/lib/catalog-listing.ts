export type CatalogListingTarget =
  | { kind: "project"; projectId: string }
  | { kind: "person"; projectId?: undefined };

export function catalogListingQueryKey(target: CatalogListingTarget) {
  return ["catalog-listing", target.kind, target.projectId ?? "me"] as const;
}
