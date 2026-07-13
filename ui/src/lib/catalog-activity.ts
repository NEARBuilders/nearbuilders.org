export type CatalogClaimActivityPayload = {
  claimId: string;
  projectSlug: string;
  catalogUrl: string;
  projectName: string;
  projectTagline: string | null;
  projectImageUrl: string | null;
  repositoryUrl: string | null;
  roles: string[];
};

export function readCatalogClaimActivityPayload(
  payload: unknown,
): CatalogClaimActivityPayload | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  if (
    typeof value.claimId !== "string" ||
    typeof value.projectSlug !== "string" ||
    typeof value.catalogUrl !== "string" ||
    typeof value.projectName !== "string" ||
    !Array.isArray(value.roles)
  ) {
    return null;
  }
  return {
    claimId: value.claimId,
    projectSlug: value.projectSlug,
    catalogUrl: value.catalogUrl,
    projectName: value.projectName,
    projectTagline: typeof value.projectTagline === "string" ? value.projectTagline : null,
    projectImageUrl: typeof value.projectImageUrl === "string" ? value.projectImageUrl : null,
    repositoryUrl: typeof value.repositoryUrl === "string" ? value.repositoryUrl : null,
    roles: value.roles.filter((role): role is string => typeof role === "string"),
  };
}
