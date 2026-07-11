export function catalogProjectReference(slug: string): string {
  return `nearcatalog:${slug}`;
}

export function catalogClaimId(nearAccount: string, projectSlug: string): string {
  return `claim:${nearAccount.trim().toLowerCase()}:${projectSlug}`;
}
