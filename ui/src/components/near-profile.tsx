import { useQuery } from "@tanstack/react-query";
import type { Profile } from "better-near-auth";
import Markdown from "react-markdown";
import { useAuthClient } from "@/app";
import { Skeleton } from "@/components/ui/skeleton";

interface NearProfileProps {
  accountId?: string;
  variant?: "badge" | "card";
  showAvatar?: boolean;
  showName?: boolean;
  className?: string;
}

export function NearProfile({
  accountId,
  variant = "badge",
  showAvatar = true,
  showName = true,
  className = "",
}: NearProfileProps) {
  const auth = useAuthClient();
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<Profile | null>({
    queryKey: ["near-profile", accountId],
    queryFn: async () => {
      const res = await auth.near.getProfile(accountId);
      return res.data || null;
    },
    enabled: !!accountId,
  });

  const profileName = profile?.name?.trim();
  const displayName = profileName || accountId || "Builder";
  const accountLabel = accountId ? `@${accountId}` : null;
  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);
  const backgroundUrl =
    profile?.backgroundImage?.url ??
    (profile?.backgroundImage?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${profile.backgroundImage.ipfs_cid}`
      : null);

  if (isLoading) {
    if (variant === "card") {
      return (
        <div className={`w-full ${className}`}>
          <div className="relative">
            <Skeleton className="h-32 w-full rounded-t-lg" />
            <div className="absolute -bottom-6 left-6">
              <Skeleton className="h-12 w-12 rounded-full border-4 border-background" />
            </div>
          </div>
          <div className="pt-8 px-6 pb-6">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-full mb-4" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-center justify-start space-x-3 w-24 ${className}`}>
        {showAvatar && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
        {showName && <Skeleton className="h-4 w-16 flex-shrink-0" />}
      </div>
    );
  }

  if (error) {
    if (variant === "card") {
      return (
        <div className={`w-full bg-card rounded-lg border ${className}`}>
          <div className="p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg mx-auto mb-4">
              ?
            </div>
            <p className="text-sm text-muted-foreground">Failed to load profile</p>
            {accountId && <p className="text-xs text-muted-foreground mt-1">{accountId}</p>}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {showAvatar && (
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
            ?
          </div>
        )}
        {showName && <span className="text-sm text-muted-foreground">{accountId}</span>}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`w-full overflow-hidden rounded-xl border border-border bg-card ${className}`}
      >
        <div className="relative h-36 bg-secondary">
          <div className="absolute inset-x-0 top-0 h-1 bg-brand-green" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
          {backgroundUrl && (
            <img
              src={backgroundUrl}
              alt="Profile background"
              className="relative h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="absolute -bottom-8 left-5 sm:left-6">
            <div className="h-16 w-16 overflow-hidden rounded-full border-4 border-background bg-background shadow-lg ring-1 ring-border">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${displayName} avatar`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-bold text-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-10 sm:px-6 sm:pb-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-bold tracking-tight text-foreground">{displayName}</h3>
            {accountLabel && (
              <p className="font-mono text-sm font-semibold text-brand-cyan">{accountLabel}</p>
            )}
          </div>

          {!profile?.description && (
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              NEAR account connected. Add projects and keep your builder presence current.
            </p>
          )}

          {profile?.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              <Markdown>{profile.description}</Markdown>
            </p>
          )}

          {profile?.linktree && Object.keys(profile.linktree).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(profile.linktree).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold transition-colors hover:bg-secondary"
                >
                  {platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-start space-x-2 w-24 ${className}`}>
      {showAvatar && (
        <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${displayName} avatar`}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs font-medium text-muted-foreground">
              {displayName?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      {showName && (
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium truncate text-left">{displayName}</span>
        </div>
      )}
    </div>
  );
}
