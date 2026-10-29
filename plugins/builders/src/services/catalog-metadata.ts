import type { z } from "zod";
import type { builderCatalogSchema } from "../contract";

export type BuilderCatalogMetadata = z.output<typeof builderCatalogSchema>;

const CONTACT_LINK_KEYS = {
  Telegram: "telegram",
  Discord: "discord",
  X: "twitter",
  Website: "website",
} as const;

export function normalizeBuilderCatalog(
  input: BuilderCatalogMetadata | null | undefined,
): BuilderCatalogMetadata | null {
  if (!input) return null;
  const result: BuilderCatalogMetadata = {};
  if (input.preferredContact) result.preferredContact = input.preferredContact;
  for (const key of ["organization", "team", "jobTitle", "publicEmail", "avatarUrl"] as const) {
    const value = input[key]?.trim();
    if (value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function preferredContactError(
  catalog: BuilderCatalogMetadata | null,
  links: Record<string, string> | null,
): string | null {
  const contact = catalog?.preferredContact;
  if (!contact) return null;
  if (contact === "Email") {
    return catalog?.publicEmail
      ? null
      : "Add a public email to use email as your preferred contact";
  }
  const key = CONTACT_LINK_KEYS[contact];
  return links?.[key]?.trim()
    ? null
    : `Add your ${contact} link to use ${contact} as your preferred contact`;
}
