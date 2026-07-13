export type CatalogClaimProposalStatus = "pending" | "approved" | "rejected" | "revoked";

export function canResubmitCatalogClaim(status: CatalogClaimProposalStatus) {
  return status === "rejected" || status === "revoked";
}
