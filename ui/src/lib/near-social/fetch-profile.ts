import { NEAR_SOCIAL_API2_BASE, NEAR_SOCIAL_LEGACY_API_BASE } from "./constants";
import { emptyNearProfile, profileFromLegacyApi, profileFromNewApi } from "./normalize";
import type { NearSocialApiProfile, NearSocialLegacyAccount, ResolvedNearProfile } from "./types";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function legacyHasUsableProfile(legacy: NearSocialLegacyAccount | null): boolean {
  if (!legacy?.exists) return false;
  const profile = legacy.profile;
  if (!profile) return Boolean(legacy.avatar || legacy.banner);
  return Boolean(
    profile.name?.trim() ||
      profile.about?.trim() ||
      profile.location?.trim() ||
      Object.keys(profile.links ?? {}).length > 0 ||
      legacy.avatar ||
      legacy.banner,
  );
}

async function fetchLegacySocialDbProfile(
  accountId: string,
  signal?: AbortSignal,
): Promise<ResolvedNearProfile | null> {
  const url = new URL(`${NEAR_SOCIAL_LEGACY_API_BASE}/get`);
  url.searchParams.set("keys", `${accountId}/profile/**`);
  const data = await fetchJson<Record<string, { profile?: Record<string, unknown> } | undefined>>(
    url.toString(),
    signal,
  );
  const profile = data?.[accountId]?.profile;
  if (!profile || typeof profile !== "object") return null;

  const name = typeof profile.name === "string" ? profile.name : undefined;
  const description = typeof profile.description === "string" ? profile.description : undefined;
  const image =
    profile.image && typeof profile.image === "object"
      ? (profile.image as { url?: string; ipfs_cid?: string })
      : undefined;
  const backgroundImage =
    profile.backgroundImage && typeof profile.backgroundImage === "object"
      ? (profile.backgroundImage as { url?: string; ipfs_cid?: string })
      : undefined;
  const linktree =
    profile.linktree && typeof profile.linktree === "object"
      ? (profile.linktree as Record<string, string>)
      : undefined;

  const hasContent = Boolean(
    name?.trim() ||
      description?.trim() ||
      image?.url ||
      image?.ipfs_cid ||
      backgroundImage?.url ||
      backgroundImage?.ipfs_cid ||
      (linktree && Object.keys(linktree).length > 0),
  );
  if (!hasContent) return null;

  return {
    accountId,
    name: name?.trim() || undefined,
    description: description?.trim() || undefined,
    image,
    backgroundImage,
    linktree,
    hasNewProfile: false,
    hasLegacyProfile: true,
    source: "legacy",
  };
}

export async function fetchResolvedNearProfile(
  accountId: string,
  signal?: AbortSignal,
): Promise<ResolvedNearProfile> {
  const trimmed = accountId.trim();
  if (!trimmed) return emptyNearProfile(accountId);

  const apiProfile = await fetchJson<NearSocialApiProfile>(
    `${NEAR_SOCIAL_API2_BASE}/v1/accounts/${encodeURIComponent(trimmed)}`,
    signal,
  );

  if (apiProfile?.has_profile) {
    return profileFromNewApi(trimmed, apiProfile);
  }

  const legacy = await fetchJson<NearSocialLegacyAccount>(
    `${NEAR_SOCIAL_API2_BASE}/v1/legacy/${encodeURIComponent(trimmed)}`,
    signal,
  );

  if (legacyHasUsableProfile(legacy)) {
    return profileFromLegacyApi(trimmed, legacy!);
  }

  const socialDb = await fetchLegacySocialDbProfile(trimmed, signal);
  if (socialDb) return socialDb;

  return emptyNearProfile(trimmed);
}
