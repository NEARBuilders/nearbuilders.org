import { NEAR_SOCIAL_IPFS_GATEWAY } from "./constants";
import type { NearSocialImage, ResolvedNearProfile } from "./types";

export function resolveNearSocialImageUrl(
  image: NearSocialImage | null | undefined,
): string | null {
  if (!image) return null;
  if (image.url?.trim()) return image.url.trim();
  if (image.ipfs_cid?.trim()) return `${NEAR_SOCIAL_IPFS_GATEWAY}/${image.ipfs_cid.trim()}`;
  return null;
}

export function getNearSocialAvatarUrl(
  profile: Pick<ResolvedNearProfile, "image"> | null | undefined,
): string | null {
  return resolveNearSocialImageUrl(profile?.image);
}

export function getNearSocialBannerUrl(
  profile: Pick<ResolvedNearProfile, "backgroundImage"> | null | undefined,
): string | null {
  return resolveNearSocialImageUrl(profile?.backgroundImage);
}

export function hasNearSocialAvatar(
  profile: Pick<ResolvedNearProfile, "image"> | null | undefined,
): boolean {
  return Boolean(getNearSocialAvatarUrl(profile));
}
