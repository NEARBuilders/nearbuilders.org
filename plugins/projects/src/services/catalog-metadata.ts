import type { z } from "zod";
import type { projectCatalogSchema } from "../contract";

export type ProjectCatalogMetadata = z.output<typeof projectCatalogSchema>;

export function normalizeProjectCatalog(
  input: ProjectCatalogMetadata | null | undefined,
): ProjectCatalogMetadata | null {
  if (!input) return null;
  const result: ProjectCatalogMetadata = {};

  const tagline = input.tagline?.trim();
  if (tagline) result.tagline = tagline;

  const categories = Array.from(
    new Set((input.categories ?? []).map((category) => category.trim()).filter(Boolean)),
  );
  if (categories.length > 0) result.categories = categories;

  if (input.phase) result.phase = input.phase;

  const links = Object.fromEntries(
    Object.entries(input.links ?? {})
      .map(([key, value]) => [key, value?.trim()] as const)
      .filter(([, value]) => Boolean(value)),
  );
  if (Object.keys(links).length > 0) result.links = links;

  const tokenContract = input.tokenContract?.trim();
  if (tokenContract) result.tokenContract = tokenContract;

  const coingeckoId = input.coingeckoId?.trim();
  if (coingeckoId) result.coingeckoId = coingeckoId;

  return Object.keys(result).length > 0 ? result : null;
}
