export type NearSocialProfileSource = "new" | "legacy" | "none";

export type NearSocialImage = {
  url?: string;
  ipfs_cid?: string;
};

export type ResolvedNearProfile = {
  accountId: string;
  name?: string;
  description?: string;
  image?: NearSocialImage;
  backgroundImage?: NearSocialImage;
  linktree?: Record<string, string>;
  location?: string | null;
  hasNewProfile: boolean;
  hasLegacyProfile: boolean;
  source: NearSocialProfileSource;
};

export type NearSocialApiProfile = {
  account_id: string;
  has_profile: boolean;
  name: string | null;
  about: string | null;
  avatar: string | null;
  avatar_url: string | null;
  banner: string | null;
  banner_url: string | null;
  location: string | null;
  links: Record<string, string>;
};

export type NearSocialLegacyImage = {
  kind: string;
  proxy_url: string;
  url?: string;
  cid?: string;
};

export type NearSocialLegacyAccount = {
  account_id: string;
  exists: boolean;
  profile: {
    name: string | null;
    about: string | null;
    location: string | null;
    links: Record<string, string>;
  } | null;
  avatar: NearSocialLegacyImage | null;
  banner: NearSocialLegacyImage | null;
};
