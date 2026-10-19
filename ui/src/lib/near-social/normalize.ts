import { NEAR_SOCIAL_API2_BASE, NEAR_SOCIAL_IPFS_GATEWAY } from "./constants";
import type {
  NearSocialApiProfile,
  NearSocialImage,
  NearSocialLegacyAccount,
  NearSocialLegacyImage,
  ResolvedNearProfile,
} from "./types";

const LINK_ALIASES: Record<string, string> = {
  x: "twitter",
  twitter: "twitter",
};

export function normalizeLinktree(
  links: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(links ?? {})) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const mapped = LINK_ALIASES[key] ?? key;
    out[mapped] = trimmed;
  }
  return out;
}

function imageFromUrl(url: string | null | undefined): NearSocialImage | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return { url: trimmed };
}

function imageFromLegacy(
  image: NearSocialLegacyImage | null | undefined,
): NearSocialImage | undefined {
  if (!image) return undefined;
  if (image.url?.trim()) return { url: image.url.trim() };
  if (image.cid?.trim()) return { url: `${NEAR_SOCIAL_IPFS_GATEWAY}/${image.cid.trim()}` };
  if (image.proxy_url?.trim()) {
    const path = image.proxy_url.startsWith("/") ? image.proxy_url : `/${image.proxy_url}`;
    return { url: `${NEAR_SOCIAL_API2_BASE}${path}` };
  }
  return undefined;
}

function optionalString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function profileFromNewApi(
  accountId: string,
  profile: NearSocialApiProfile,
): ResolvedNearProfile {
  const linktree = normalizeLinktree(profile.links);
  return {
    accountId,
    name: optionalString(profile.name),
    description: optionalString(profile.about),
    image: imageFromUrl(profile.avatar_url),
    backgroundImage: imageFromUrl(profile.banner_url),
    linktree: Object.keys(linktree).length > 0 ? linktree : undefined,
    location: optionalString(profile.location) ?? null,
    hasNewProfile: true,
    hasLegacyProfile: false,
    source: "new",
  };
}

export function profileFromLegacyApi(
  accountId: string,
  legacy: NearSocialLegacyAccount,
): ResolvedNearProfile {
  const linktree = normalizeLinktree(legacy.profile?.links);
  return {
    accountId,
    name: optionalString(legacy.profile?.name),
    description: optionalString(legacy.profile?.about),
    image: imageFromLegacy(legacy.avatar),
    backgroundImage: imageFromLegacy(legacy.banner),
    linktree: Object.keys(linktree).length > 0 ? linktree : undefined,
    location: optionalString(legacy.profile?.location) ?? null,
    hasNewProfile: false,
    hasLegacyProfile: true,
    source: "legacy",
  };
}

export function emptyNearProfile(accountId: string): ResolvedNearProfile {
  return {
    accountId,
    hasNewProfile: false,
    hasLegacyProfile: false,
    source: "none",
  };
}

export function needsLegacySocialImport(profile: ResolvedNearProfile | null | undefined): boolean {
  return Boolean(profile?.hasLegacyProfile && !profile.hasNewProfile);
}

export function isNearAccountId(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.includes(".") || /^[0-9a-f]{64}$/i.test(value);
}
