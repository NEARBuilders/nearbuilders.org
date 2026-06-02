import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, MapPin, Search, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sessionQueryOptions, useApiClient, useAuthClient, useOrpc } from "@/app";
import { NearProfile } from "@/components/near-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

interface ProposalPayload {
  name?: string;
  bio?: string;
  skills?: string[];
  location?: string;
}

interface Proposal {
  id: string;
  pluginId: string;
  entityId: string;
  operation: string;
  payload: unknown;
  schemaVersion: string;
  createdBy: string;
  reviewStatus: "pending" | "approved" | "rejected" | "removed";
  applyStatus: string;
  removeStatus: string;
  rejectionReason: string | null;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
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
            className="pl-9 rounded-full bg-secondary"
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

      <NominationsSection
        apiClient={apiClient}
        isAuthenticated={isAuthenticated}
        userId={session?.user?.id}
      />

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-foreground p-8">
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
        <div className="rounded-xl bg-foreground p-8">
          <h2 className="text-xl font-black text-background mb-1">Know a builder?</h2>
          <p className="text-sm text-background/60 mb-4">
            Nominate someone from the NEAR community to be recognized as a builder.
          </p>
          <Link
            to="/builders/add"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-green text-black text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Nominate a builder
          </Link>
        </div>
      </div>
    </div>
  );
}

function NominationsSection({
  apiClient,
  isAuthenticated,
  userId,
}: {
  apiClient: ReturnType<typeof useApiClient>;
  isAuthenticated: boolean;
  userId: string | undefined;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const orpc = useOrpc();
  const queryClient = useQueryClient();

  const [sectionOpen, setSectionOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: proposalsData, isLoading: proposalsLoading } = useQuery({
    queryKey: ["proposals", "builders", "pending"],
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "builders",
        reviewStatus: "pending",
        limit: 100,
      }),
  });

  const proposals = proposalsData?.data ?? [];
  const proposalIds = useMemo(() => proposals.map((p) => p.id), [proposals]);

  const nominationCounts = useQuery({
    queryKey: ["nominationCounts", proposalIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        proposals.map(async (p) => {
          try {
            const result = await apiClient.getUpvoteCount({ entityId: p.id });
            counts[p.id] = result.totalCount ?? 0;
          } catch {
            counts[p.id] = 0;
          }
        }),
      );
      return counts;
    },
    enabled: proposals.length > 0,
  });

  const nominationVoteStates = useQuery({
    queryKey: ["nominationVoteStates", proposalIds],
    queryFn: async () => {
      const votes: Record<string, boolean> = {};
      await Promise.all(
        proposals.map(async (p) => {
          try {
            const result = await apiClient.getUserVote({ entityId: p.id });
            votes[p.id] = result.hasUpvote;
          } catch {
            votes[p.id] = false;
          }
        }),
      );
      return votes;
    },
    enabled: isAuthenticated && proposals.length > 0,
  });

  const counts = nominationCounts.data ?? {};
  const voteMap = nominationVoteStates.data ?? {};

  const { data: latestVote } = useQuery(
    orpc.subscribeUpvotes.experimental_liveOptions({ retry: true }),
  );

  useEffect(() => {
    if (!latestVote) return;
    const { entityId: latestEntityId, totalCount, type } = latestVote;
    if (!proposalIds.includes(latestEntityId)) return;
    queryClient.setQueryData(
      ["nominationCounts", proposalIds],
      (old: Record<string, number> | undefined) => ({ ...old, [latestEntityId]: totalCount }),
    );
    if (userId && latestVote.userId === userId) {
      queryClient.setQueryData(
        ["nominationVoteStates", proposalIds],
        (old: Record<string, boolean> | undefined) => ({
          ...old,
          [latestEntityId]: type === "upvote",
        }),
      );
    }
  }, [latestVote, queryClient, proposalIds, userId]);

  const upvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.upvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["nominationCounts", proposalIds],
        (old: Record<string, number> | undefined) => ({ ...old, [data.entityId]: data.totalCount }),
      );
      queryClient.setQueryData(
        ["nominationVoteStates", proposalIds],
        (old: Record<string, boolean> | undefined) => ({ ...old, [data.entityId]: true }),
      );
    },
  });

  const downvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.downvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["nominationCounts", proposalIds],
        (old: Record<string, number> | undefined) => ({ ...old, [data.entityId]: data.totalCount }),
      );
      queryClient.setQueryData(
        ["nominationVoteStates", proposalIds],
        (old: Record<string, boolean> | undefined) => ({ ...old, [data.entityId]: false }),
      );
    },
  });

  const handleVote = (proposalId: string) => {
    if (!isAuthenticated) {
      void navigate({ to: "/login", search: { redirect: pathname } });
      return;
    }
    if (voteMap[proposalId]) {
      downvoteMutation.mutate(proposalId);
    } else {
      upvoteMutation.mutate(proposalId);
    }
  };

  if (!proposalsLoading && proposals.length === 0) return null;

  return (
    <div className="mt-12">
      <button
        type="button"
        onClick={() => {
          setSectionOpen((o) => !o);
          if (sectionOpen) setExpandedId(null);
        }}
        className="flex items-center gap-2 mb-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
      >
        <h2 className="text-xl font-black tracking-tight text-foreground">Nominated builders</h2>
        {proposals.length > 0 && (
          <Badge variant="secondary" className="text-xs px-2 py-0.5 rounded-full">
            {proposals.length}
          </Badge>
        )}
        <motion.span
          animate={{ rotate: sectionOpen ? 90 : 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          className="inline-flex"
        >
          <ChevronRight size={18} className="text-muted-foreground" />
        </motion.span>
      </button>

      {!sectionOpen && proposals.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {proposals.length} builder{proposals.length !== 1 ? "s" : ""} awaiting review —{" "}
          <button
            type="button"
            onClick={() => setSectionOpen(true)}
            className="text-brand-cyan hover:underline"
          >
            show nominations
          </button>
        </p>
      )}

      <AnimatePresence initial={false}>
        {sectionOpen && (
          <motion.div
            key="nominations-list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-4 border border-border rounded-xl overflow-hidden">
              {proposalsLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <NominationRowSkeleton key={i} isLast={i === 2} />
                  ))
                : proposals.map((p, i) => (
                    <NominationRow
                      key={p.id}
                      proposal={p}
                      nominationCount={p.submissionCount + (counts[p.id] ?? 0)}
                      hasNominated={voteMap[p.id] ?? false}
                      isVoting={
                        (upvoteMutation.isPending && upvoteMutation.variables === p.id) ||
                        (downvoteMutation.isPending && downvoteMutation.variables === p.id)
                      }
                      isExpanded={expandedId === p.id}
                      isLast={i === proposals.length - 1}
                      onToggle={() => setExpandedId((prev) => (prev === p.id ? null : p.id))}
                      onVote={() => handleVote(p.id)}
                    />
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NominationRow({
  proposal,
  nominationCount,
  hasNominated,
  isVoting,
  isExpanded,
  isLast,
  onToggle,
  onVote,
}: {
  proposal: Proposal;
  nominationCount: number;
  hasNominated: boolean;
  isVoting: boolean;
  isExpanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  onVote: () => void;
}) {
  const raw = proposal.payload;
  const payload: ProposalPayload = (
    typeof raw === "object" && raw !== null ? raw : {}
  ) as ProposalPayload;
  const displayName = payload.name || proposal.entityId;
  const skills: string[] = Array.isArray(payload.skills) ? payload.skills : [];
  const location = payload.location || null;

  const auth = useAuthClient();
  const { data: profile } = useQuery<Profile | null>({
    queryKey: ["near-profile", proposal.entityId],
    queryFn: async () => {
      const res = await auth.near.getProfile(proposal.entityId);
      return res.data || null;
    },
    enabled: !!proposal.entityId,
    staleTime: 5 * 60 * 1000,
  });

  const resolvedName =
    displayName === proposal.entityId && profile?.name ? profile.name : displayName;
  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);

  return (
    <div className={cn("bg-card", !isLast && "border-b border-border")}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          isExpanded ? "bg-muted/50" : "hover:bg-muted/40",
        )}
      >
        <div className="size-9 sm:size-10 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={resolvedName}
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="text-xs font-black text-muted-foreground">
              {getInitials(resolvedName)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-foreground leading-tight truncate">
              {resolvedName}
            </span>
            <span className="text-xs font-mono text-brand-cyan truncate hidden sm:inline">
              {proposal.entityId}
            </span>
            {location && (
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={10} />
                {location}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 sm:gap-1.5">
            <span className="text-xs font-mono text-brand-cyan sm:hidden truncate max-w-[140px]">
              {proposal.entityId}
            </span>
            {skills.slice(0, 4).map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="text-[10px] sm:text-xs px-1.5 py-0 rounded-full font-medium hidden sm:inline-flex"
              >
                {skill}
              </Badge>
            ))}
            {skills.length > 4 && (
              <Badge
                variant="secondary"
                className="text-[10px] sm:text-xs px-1.5 py-0 rounded-full font-medium hidden sm:inline-flex"
              >
                +{skills.length - 4}
              </Badge>
            )}
          </div>
        </div>

        {/* biome-ignore lint/a11y/useSemanticElements: stopPropagation wrapper */}
        <div
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") e.stopPropagation();
          }}
        >
          <span className="text-xs font-bold text-muted-foreground min-w-[2ch] text-right tabular-nums">
            {nominationCount}
          </span>
          <Button
            variant={hasNominated ? "secondary" : "outline"}
            size="sm"
            onClick={onVote}
            disabled={isVoting}
            className={cn(
              "gap-1.5 rounded-full text-xs h-7 px-3",
              hasNominated && "border-brand-accent bg-brand-accent-light text-foreground",
            )}
          >
            <ThumbsUp size={12} className={cn(hasNominated && "fill-current text-brand-accent")} />
            <span className="hidden sm:inline">{hasNominated ? "Nominated" : "Nominate"}</span>
          </Button>
        </div>

        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          className="inline-flex shrink-0 text-muted-foreground"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border bg-muted/30 px-4 sm:px-6 py-5">
              <NearProfile accountId={proposal.entityId} variant="card" className="max-w-lg" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NominationRowSkeleton({ isLast }: { isLast: boolean }) {
  return (
    <div
      className={cn(
        "bg-card flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5",
        !isLast && "border-b border-border",
      )}
    >
      <Skeleton className="size-9 sm:size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-36" />
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  );
}

function useInfiniteBuilders(
  apiClient: ReturnType<typeof useApiClient>,
  search: string,
  limit: number,
) {
  const [pages, setPages] = useState<
    { data: Builder[]; meta: { hasMore: boolean; nextCursor: string | null } }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);

  const fetch = useCallback(
    async (cursor?: string, reset = false) => {
      try {
        const result = await apiClient.builders.listBuilders({
          search: search || undefined,
          limit,
          cursor,
        });
        setPages((prev) => (reset ? [result] : [...prev, result]));
        setHasNextPage(result.meta.hasMore);
        cursorRef.current = result.meta.nextCursor ?? undefined;
      } finally {
        setIsLoading(false);
        setIsFetchingNextPage(false);
      }
    },
    [apiClient, search, limit],
  );

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

function BuilderCard({
  builder,
  auth,
}: {
  builder: Builder;
  auth: ReturnType<typeof useAuthClient>;
}) {
  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["near-profile", builder.nearAccount],
    queryFn: async () => {
      const res = await auth.near.getProfile(builder.nearAccount);
      return res.data || null;
    },
    enabled: !!builder.nearAccount,
    staleTime: 5 * 60 * 1000,
  });

  const displayName = builder.name || profile?.name || builder.nearAccount;

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
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
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
