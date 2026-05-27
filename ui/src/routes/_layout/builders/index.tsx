import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "better-near-auth";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_layout/builders/")({
  head: () => ({
    meta: [
      { title: "Builders | NEAR Builders" },
      {
        name: "description",
        content:
          "Discover builders in the NEAR ecosystem. Find collaborators, explore profiles, and connect with the community.",
      },
    ],
  }),
  component: BuildersPage,
});

interface Builder {
  id: string;
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
}

const PAGE_SIZE = 24;

function BuildersPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const {
    data: pages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteBuilders(apiClient, debouncedQuery, PAGE_SIZE);

  const builders = useMemo(() => pages?.pages.flatMap((p) => p.data) ?? [], [pages]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasNextPage || isFetchingNextPage) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      });
      observerRef.current.observe(node);
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="mb-10">
        <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">Builders</h1>
        <p className="text-muted-foreground text-lg mb-6 max-w-2xl">
          Discover the people building on NEAR. Find collaborators, explore their work, and connect
          with the community.
        </p>

        <div className="relative w-full sm:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            type="search"
            placeholder="Search by name, skill, or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 rounded-full bg-secondary border-border focus-visible:ring-brand-green"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <BuilderCardSkeleton key={i} />
          ))}
        </div>
      ) : builders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">🔭</div>
          <p className="text-lg font-semibold text-foreground mb-1">No builders found</p>
          <p className="text-sm text-muted-foreground">
            {debouncedQuery
              ? "Try a different search — more builders join every day."
              : "Be the first to register as a builder on NEAR."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {builders.map((b) => (
              <BuilderCard key={b.id} builder={b} auth={auth} />
            ))}
          </div>

          <div ref={sentinelRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
            )}
          </div>
        </>
      )}

      <div className="mt-16 rounded-xl bg-foreground p-8">
        <h2 className="text-xl font-black text-background mb-1">Are you building on NEAR?</h2>
        <p className="text-sm text-background/60 mb-4">
          {isAuthenticated
            ? "Claim your builder profile and get discovered by the community."
            : "Connect your NEAR wallet and register as a builder."}
        </p>
        <Link
          to={isAuthenticated ? "/home" : "/login"}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-cyan text-black text-sm font-bold hover:opacity-90 transition-opacity"
        >
          {isAuthenticated ? "Manage your profile" : "Connect your wallet"}
        </Link>
      </div>
    </div>
  );
}

function useInfiniteBuilders(apiClient: ReturnType<typeof useApiClient>, search: string, limit: number) {
  const [pages, setPages] = useState<{ data: Builder[]; meta: { hasMore: boolean; nextCursor: string | null } }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);

  const fetch = useCallback(async (cursor?: string, reset = false) => {
    try {
      const result = await apiClient.builders.listBuilders({
        search: search || undefined,
        limit,
        cursor,
      });
      setPages((prev) => reset ? [result] : [...prev, result]);
      setHasNextPage(result.meta.hasMore);
      cursorRef.current = result.meta.nextCursor ?? undefined;
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [apiClient, search, limit]);

  useEffect(() => {
    setIsLoading(true);
    setPages([]);
    cursorRef.current = undefined;
    fetch(undefined, true);
  }, [fetch]);

  const fetchNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    setIsFetchingNextPage(true);
    fetch(cursorRef.current);
  }, [fetch, hasNextPage, isFetchingNextPage]);

  return { data: { pages }, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage };
}

function BuilderCard({ builder, auth }: { builder: Builder; auth: ReturnType<typeof useAuthClient> }) {
  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["near-profile", builder.nearAccount],
    queryFn: async () => {
      const res = await auth.near.getProfile(builder.nearAccount);
      return res.data || null;
    },
    enabled: !!builder.nearAccount,
    staleTime: 5 * 60 * 1000,
  });

  const displayName =
    builder.name || profile?.name || builder.nearAccount;

  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);

  const bio = builder.bio || profile?.description || null;

  return (
    <Link
      to="/builders/$account"
      params={{ account: builder.nearAccount }}
      className="group bg-card border border-border rounded-lg p-6 hover:shadow-lg hover:border-border/80 transition-all duration-200 flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        <div className="size-12 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center">
          {isLoading ? (
            <Skeleton className="size-12 rounded-full" />
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="size-12 object-cover"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="text-sm font-black text-muted-foreground">
              {getInitials(displayName)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          {isLoading ? (
            <>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-20" />
            </>
          ) : (
            <>
              <div className="font-bold text-foreground leading-tight truncate">{displayName}</div>
              <div className="text-xs font-mono text-brand-cyan mt-0.5 truncate">
                {builder.nearAccount}
              </div>
              {builder.location && (
                <div className="text-xs text-muted-foreground mt-0.5">{builder.location}</div>
              )}
            </>
          )}
        </div>
      </div>

      {bio ? (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">{bio}</p>
      ) : (
        <div className="flex-1" />
      )}

      {builder.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {builder.skills.slice(0, 5).map((skill) => (
            <Badge
              key={skill}
              variant="secondary"
              className="text-xs px-2 py-0.5 rounded-full font-medium"
            >
              {skill}
            </Badge>
          ))}
          {builder.skills.length > 5 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full font-medium">
              +{builder.skills.length - 5}
            </Badge>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-border">
        <span className="text-xs font-semibold text-brand-cyan group-hover:underline transition-colors">
          View profile →
        </span>
      </div>
    </Link>
  );
}

function BuilderCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="pt-3 border-t border-border">
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
