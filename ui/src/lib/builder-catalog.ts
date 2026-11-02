import type { ApiClient } from "@/app";
import { isSafeImageUrl } from "./image-url";
import { getNearSocialAvatarUrl, type ResolvedNearProfile } from "./near-social";

export type BuilderCatalog = NonNullable<
  Awaited<ReturnType<ApiClient["getBuilder"]>>["data"]["catalog"]
>;

export const PREFERRED_CONTACTS = [
  { value: "Telegram", linkKey: "telegram" },
  { value: "X", linkKey: "twitter" },
  { value: "Discord", linkKey: "discord" },
  { value: "Website", linkKey: "website" },
  { value: "Email", linkKey: null },
] as const;

export type PreferredContact = (typeof PREFERRED_CONTACTS)[number]["value"];

export type BuilderCatalogFormValues = {
  preferredContact: PreferredContact | "";
  organization: string;
  team: string;
  jobTitle: string;
  publicEmail: string;
  avatarUrl: string;
};

export const emptyBuilderCatalog = (): BuilderCatalogFormValues => ({
  preferredContact: "",
  organization: "",
  team: "",
  jobTitle: "",
  publicEmail: "",
  avatarUrl: "",
});

export function builderCatalogToFormValues(
  catalog: BuilderCatalog | null | undefined,
): BuilderCatalogFormValues {
  return {
    preferredContact: catalog?.preferredContact ?? "",
    organization: catalog?.organization ?? "",
    team: catalog?.team ?? "",
    jobTitle: catalog?.jobTitle ?? "",
    publicEmail: catalog?.publicEmail ?? "",
    avatarUrl: catalog?.avatarUrl ?? "",
  };
}

export function builderCatalogFromFormValues(
  values: BuilderCatalogFormValues | undefined,
): BuilderCatalog | null {
  if (!values) return null;
  const catalog: BuilderCatalog = {};
  if (values.preferredContact) catalog.preferredContact = values.preferredContact;
  for (const key of ["organization", "team", "jobTitle", "publicEmail", "avatarUrl"] as const) {
    const value = values[key].trim();
    if (value) catalog[key] = value;
  }
  return Object.keys(catalog).length > 0 ? catalog : null;
}

export type BuilderCatalogErrors = Partial<
  Record<
    "preferredContact" | "organization" | "team" | "jobTitle" | "publicEmail" | "avatarUrl",
    string
  >
>;

export function getBuilderCatalogErrors(
  values: BuilderCatalogFormValues | undefined,
  links: Record<string, string | undefined> | undefined,
): BuilderCatalogErrors {
  const errors: BuilderCatalogErrors = {};
  if (!values) return errors;
  if (values.organization.trim().length > 100) errors.organization = "Max 100 characters";
  if (values.team.trim().length > 100) errors.team = "Max 100 characters";
  if (values.jobTitle.trim().length > 80) errors.jobTitle = "Max 80 characters";
  const email = values.publicEmail.trim();
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.publicEmail = "Enter a valid email address";
  }
  const avatar = values.avatarUrl.trim();
  if (avatar) {
    try {
      const url = new URL(avatar);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      errors.avatarUrl = "Avatar URL must be an absolute http(s) URL";
    }
  }
  const contact = PREFERRED_CONTACTS.find((item) => item.value === values.preferredContact);
  if (contact) {
    const filled = contact.linkKey ? Boolean(links?.[contact.linkKey]?.trim()) : Boolean(email);
    if (!filled) {
      errors.preferredContact =
        contact.value === "Email"
          ? "Add a public email to use email as your preferred contact"
          : `Add your ${contact.value} link to use ${contact.value} as your preferred contact`;
    }
  }
  return errors;
}

export function validateBuilderCatalog(
  values: BuilderCatalogFormValues | undefined,
  links: Record<string, string | undefined> | undefined,
) {
  return Object.values(getBuilderCatalogErrors(values, links))[0];
}

export function resolveBuilderAvatarUrl(
  catalogAvatarUrl: string | null | undefined,
  profile: Pick<ResolvedNearProfile, "image"> | null | undefined,
): string | null {
  if (isSafeImageUrl(catalogAvatarUrl)) return catalogAvatarUrl.trim();
  return getNearSocialAvatarUrl(profile);
}
