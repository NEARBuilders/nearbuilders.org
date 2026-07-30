import { z } from "zod";

export const CatalogClaimActivityPayloadSchema = z.object({
  claimId: z.string(),
  projectSlug: z.string(),
  catalogUrl: z.string(),
  projectName: z.string(),
  projectTagline: z.string().nullable(),
  projectImageUrl: z.string().nullable(),
  repositoryUrl: z.string().nullable(),
  roles: z.array(z.string()),
});

export type CatalogClaimActivityPayload = z.infer<typeof CatalogClaimActivityPayloadSchema>;

export function readCatalogClaimActivityPayload(
  payload: unknown,
): CatalogClaimActivityPayload | null {
  const result = CatalogClaimActivityPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}
