import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { ArrowRight, CheckCircle, MapPin, Search, Sparkles, ThumbsUp, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Proposal, ProposalPayload } from "@/app";
import {
  buildersInfiniteOptions,
  pendingProposalsOptions,
  sessionQueryOptions,
  upvoteCountsOptions,
  useApiClient,
  useAuthClient,
  useOrpc,
  userVotesOptions,
} from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BuilderLike {
  id: string;
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
}

type BuilderCategory = "all" | "approved" | "nominated";

type BuilderCardData =
  | { kind: "builder"; builder: BuilderLike; proposal: Proposal | null }
  | { kind: "nominated"; proposal: Proposal; payload: ProposalPayload };

function getCardId(card: BuilderCardData): string {
  return card.kind === "builder" ? card.builder.id : `nom-${card.proposal.id}`;
}

export const Route = createFileRoute("/_layout/builders/")({
  loader: async ({ context }) => {
    const { queryClient, apiClient, session } = context;
    const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

    await queryClient.prefetchInfiniteQuery(buildersInfiniteOptions(apiClient, ""));
    await queryClient.prefetchQuery(pendingProposalsOptions(apiClient));

    const proposalsData = queryClient.getQueryData(["proposals", "builders", "pending"]) as
      | { data?: { id: string }[] }
      | undefined;
    const proposalIds = proposalsData?.data?.map((p) => p.id) ?? [];

    if (proposalIds.length > 0) {
      await Promise.allSettled(
        [
          queryClient.prefetchQuery(upvoteCountsOptions(apiClient, proposalIds)),
          isAuthenticated &&
            queryClient.prefetchQuery(userVotesOptions(apiClient, proposalIds, true)),
        ].filter(Boolean),
      );
    }
  },
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

function BuildersPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<BuilderCategory>("all");
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
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery(buildersInfiniteOptions(apiClient, debouncedQuery));

  const builders = useMemo(() => infiniteData.pages.flatMap((p) => p.data), [infiniteData]);

  const { data: proposalsData } = useSuspenseQuery(pendingProposalsOptions(apiClient));
  const proposals = proposalsData.data ?? [];

  const builderAccountSet = useMemo(() => new Set(builders.map((b) => b.nearAccount)), [builders]);

  const proposalMap = useMemo(() => {
    const m = new Map<string, Proposal>();
    for (const p of proposals) {
      m.set(p.entityId, p);
    }
    return m;
  }, [proposals]);

  const mergedCards = useMemo(() => {
    const cards: BuilderCardData[] = [];

    for (const b of builders) {
      cards.push({
        kind: "builder",
        builder: b,
        proposal: proposalMap.get(b.nearAccount) ?? null,
      });
    }

    for (const p of proposals) {
      if (!builderAccountSet.has(p.entityId)) {
        const raw = p.payload;
        const payload: ProposalPayload =
          typeof raw === "object" && raw !== null ? (raw as ProposalPayload) : {};
        cards.push({ kind: "nominated", proposal: p, payload });
      }
    }

    return cards;
  }, [builders, proposals, builderAccountSet, proposalMap]);

  const allProposalIds = useMemo(() => proposals.map((p) => p.id), [proposals]);

  const { data: countsData } = useQuery(upvoteCountsOptions(apiClient, allProposalIds));
  const { data: votesData } = useQuery(
    userVotesOptions(
      apiClient,
      allProposalIds.length > 0 && isAuthenticated ? allProposalIds : [],
      isAuthenticated,
    ),
  );

  const counts = countsData ?? {};
  const voteMap = votesData ?? {};

  const getNominationCount = useCallback(
    (card: BuilderCardData): number => {
      const p = card.kind === "builder" ? card.proposal : card.proposal;
      if (!p) return 0;
      return p.submissionCount + (counts[p.id]?.totalCount ?? 0);
    },
    [counts],
  );

  const sortedCards = useMemo(() => {
    return [...mergedCards].sort((a, b) => {
      const aHasProposal = a.kind === "builder" ? a.proposal !== null : true;
      const bHasProposal = b.kind === "builder" ? b.proposal !== null : true;

      if (aHasProposal && !bHasProposal) return -1;
      if (!aHasProposal && bHasProposal) return 1;

      if (aHasProposal && bHasProposal) {
        return getNominationCount(b) - getNominationCount(a);
      }

      return 0;
    });
  }, [mergedCards, getNominationCount]);

  const filteredCards = useMemo(() => {
    if (category === "all") return sortedCards;
    if (category === "approved") return sortedCards.filter((c) => c.kind === "builder");
    return sortedCards.filter((c) => c.kind === "nominated");
  }, [sortedCards, category]);

  const categoryCounts = useMemo(() => {
    const approved = sortedCards.filter((c) => c.kind === "builder").length;
    const nominated = sortedCards.filter((c) => c.kind === "nominated").length;
    return { all: sortedCards.length, approved, nominated };
  }, [sortedCards]);

  const sortedIds = useMemo(() => filteredCards.map(getCardId), [filteredCards]);

  const orpc = useOrpc();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: latestVote } = useQuery(
    orpc.subscribeUpvotes.experimental_liveOptions({ retry: true }),
  );

  useEffect(() => {
    if (!latestVote) return;
    const { entityId: latestEntityId, totalCount, type } = latestVote;
    if (!allProposalIds.includes(latestEntityId)) return;
    queryClient.setQueryData(
      ["upvoteCounts", allProposalIds],
      (old: Record<string, { entityId: string; totalCount: number }> | undefined) => ({
        ...old,
        [latestEntityId]: { entityId: latestEntityId, totalCount },
      }),
    );
    if (session?.user?.id && latestVote.userId === session.user.id) {
      queryClient.setQueryData(
        ["userVotes", allProposalIds],
        (old: Record<string, { entityId: string; hasUpvote: boolean }> | undefined) => ({
          ...old,
          [latestEntityId]: { entityId: latestEntityId, hasUpvote: type === "upvote" },
        }),
      );
    }
  }, [latestVote, queryClient, allProposalIds, session?.user?.id]);

  const upvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.upvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["upvoteCounts", allProposalIds],
        (old: Record<string, { entityId: string; totalCount: number }> | undefined) => ({
          ...old,
          [data.entityId]: data,
        }),
      );
      queryClient.setQueryData(
        ["userVotes", allProposalIds],
        (old: Record<string, { entityId: string; hasUpvote: boolean }> | undefined) => ({
          ...old,
          [data.entityId]: { entityId: data.entityId, hasUpvote: true },
        }),
      );
    },
  });

  const downvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.downvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["upvoteCounts", allProposalIds],
        (old: Record<string, { entityId: string; totalCount: number }> | undefined) => ({
          ...old,
          [data.entityId]: data,
        }),
      );
      queryClient.setQueryData(
        ["userVotes", allProposalIds],
        (old: Record<string, { entityId: string; hasUpvote: boolean }> | undefined) => ({
          ...old,
          [data.entityId]: { entityId: data.entityId, hasUpvote: false },
        }),
      );
    },
  });

  const handleVote = (proposalId: string) => {
    if (!isAuthenticated) {
      void navigate({ to: "/login", search: { redirect: pathname } });
      return;
    }
    const entry = voteMap[proposalId];
    if (entry?.hasUpvote) {
      downvoteMutation.mutate(proposalId);
    } else {
      upvoteMutation.mutate(proposalId);
    }
  };

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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
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

        <div className="flex gap-2 mt-4 flex-wrap">
          {(
            [
              { value: "all" as const, label: "All", icon: Users },
              { value: "approved" as const, label: "Approved", icon: CheckCircle },
              { value: "nominated" as const, label: "Nominated", icon: Sparkles },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 rounded-full border px-3 text-sm font-semibold transition-all duration-150",
                category === value
                  ? "border-brand-accent bg-brand-accent-light text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={14} />
              {label}
              <span
                className={cn(
                  "text-xs tabular-nums ml-0.5",
                  category === value ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {categoryCounts[value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl mb-4">🔭</div>
          <p className="text-lg font-semibold text-foreground mb-1">No builders found</p>
          <p className="text-sm text-muted-foreground">
            {debouncedQuery
              ? "Try a different search — more builders join every day."
              : category === "approved"
                ? "No approved builders yet."
                : category === "nominated"
                  ? "No pending nominations."
                  : "Be the first to register as a builder on NEAR."}
          </p>
        </div>
      ) : (
        <>
          <Reorder.Group
            as="div"
            axis="y"
            values={sortedIds}
            onReorder={() => {}}
            className="flex flex-col gap-3"
          >
            {filteredCards.map((card) => {
              const proposal = card.kind === "builder" ? card.proposal : card.proposal;
              const nominationCount = proposal
                ? proposal.submissionCount + (counts[proposal.id]?.totalCount ?? 0)
                : null;
              const hasNominated = proposal ? voteMap[proposal.id]?.hasUpvote === true : false;
              const isVoting = proposal
                ? (upvoteMutation.isPending && upvoteMutation.variables === proposal.id) ||
                  (downvoteMutation.isPending && downvoteMutation.variables === proposal.id)
                : false;
              const onVote = proposal ? () => handleVote(proposal.id) : undefined;
              const isNominated = proposal !== null;

              if (card.kind === "builder") {
                return (
                  <Reorder.Item
                    as="div"
                    key={card.builder.id}
                    value={card.builder.id}
                    layout="position"
                    drag={false}
                    dragListener={false}
                    transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}
                  >
                    <BuilderCard
                      nearAccount={card.builder.nearAccount}
                      displayName={card.builder.name}
                      bio={card.builder.bio}
                      skills={card.builder.skills}
                      location={card.builder.location}
                      proposal={proposal}
                      nominationCount={nominationCount}
                      hasNominated={hasNominated}
                      isVoting={isVoting}
                      onVote={onVote}
                      auth={auth}
                      isNominated={isNominated}
                    />
                  </Reorder.Item>
                );
              }

              return (
                <Reorder.Item
                  as="div"
                  key={`nom-${card.proposal.id}`}
                  value={`nom-${card.proposal.id}`}
                  layout="position"
                  drag={false}
                  dragListener={false}
                  transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}
                >
                  <BuilderCard
                    nearAccount={card.proposal.entityId}
                    displayNameOverride={card.payload.name || card.proposal.entityId}
                    bioOverride={card.payload.bio || null}
                    skillsOverride={Array.isArray(card.payload.skills) ? card.payload.skills : []}
                    locationOverride={card.payload.location || null}
                    proposal={proposal}
                    nominationCount={nominationCount ?? 0}
                    hasNominated={hasNominated}
                    isVoting={isVoting}
                    onVote={onVote!}
                    auth={auth}
                    isNominated
                  />
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          <div ref={sentinelRef} className="flex justify-center py-8">
            {isFetchingNextPage && (
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
            )}
          </div>
        </>
      )}

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

function BuilderCard({
  nearAccount,
  displayName,
  bio: bioProp,
  skills: skillsProp,
  location: locationProp,
  displayNameOverride,
  bioOverride,
  skillsOverride,
  locationOverride,
  proposal,
  nominationCount,
  hasNominated,
  isVoting,
  onVote,
  auth,
  isNominated,
}: {
  nearAccount: string;
  displayName?: string | null;
  bio?: string | null;
  skills?: string[];
  location?: string | null;
  displayNameOverride?: string;
  bioOverride?: string | null;
  skillsOverride?: string[];
  locationOverride?: string | null;
  proposal: Proposal | null;
  nominationCount: number | null;
  hasNominated: boolean;
  isVoting: boolean;
  onVote: (() => void) | undefined;
  auth: ReturnType<typeof useAuthClient>;
  isNominated: boolean;
}) {
  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["near-profile", nearAccount],
    queryFn: async () => {
      const res = await auth.near.getProfile(nearAccount);
      return res.data || null;
    },
    enabled: !!nearAccount,
    staleTime: 5 * 60 * 1000,
  });

  const resolvedName = displayNameOverride
    ? displayNameOverride === nearAccount && profile?.name
      ? profile.name
      : displayNameOverride
    : displayName || profile?.name || nearAccount;

  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);

  const resolvedBio = bioOverride ?? bioProp ?? profile?.description ?? null;
  const resolvedSkills = skillsOverride ?? skillsProp ?? [];
  const resolvedLocation = locationOverride ?? locationProp ?? null;

  const showVoteButton = nominationCount !== null && onVote;

  return (
    <Link
      to="/builders/$account"
      params={{ account: nearAccount }}
      className={cn(
        "group bg-card rounded-lg px-5 py-4 sm:px-6 sm:py-5 hover:shadow-lg transition-all duration-200 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4",
        isNominated ? "border border-dashed border-border" : "border border-border",
      )}
    >
      <div className="flex items-start gap-3 sm:min-w-0 sm:flex-1">
        <div className="size-10 sm:size-12 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center">
          {isLoading ? (
            <div className="size-10 sm:size-12 rounded-full bg-muted animate-pulse" />
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={resolvedName}
              className="size-10 sm:size-12 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              className={cn(
                "size-10 sm:size-12 flex items-center justify-center bg-gradient-to-br text-white font-bold",
                getAvatarGradient(resolvedName),
              )}
            >
              <span className="text-sm sm:text-base">{getInitials(resolvedName)}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-foreground leading-tight truncate">{resolvedName}</span>
            <span className="text-xs font-mono text-brand-cyan hidden sm:inline truncate">
              {nearAccount}
            </span>
            {isNominated && (
              <Badge
                variant="secondary"
                className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-accent-light text-brand-accent border-brand-accent/20"
              >
                Nominated
              </Badge>
            )}
          </div>
          <div className="text-xs font-mono text-brand-cyan sm:hidden truncate mt-0.5">
            {nearAccount}
          </div>
          {resolvedLocation && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin size={10} />
              {resolvedLocation}
            </div>
          )}
          {resolvedBio && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{resolvedBio}</p>
          )}
          {resolvedSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {resolvedSkills.slice(0, 5).map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 rounded-full font-medium"
                >
                  {skill}
                </Badge>
              ))}
              {resolvedSkills.length > 5 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 rounded-full font-medium"
                >
                  +{resolvedSkills.length - 5}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:shrink-0">
        {showVoteButton && (
          <div className="flex items-center gap-2">
            <motion.span
              key={`count-${proposal!.id}-${nominationCount}`}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="text-sm font-bold text-muted-foreground tabular-nums"
            >
              {nominationCount}
            </motion.span>
            <motion.div
              whileTap={{ scale: 1.15 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Button
                variant={hasNominated ? "secondary" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onVote!();
                }}
                disabled={isVoting}
                className={cn(
                  "gap-1.5 rounded-full text-xs h-8 px-3",
                  hasNominated && "border-brand-accent bg-brand-accent-light text-foreground",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={hasNominated ? "filled" : "outline"}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="inline-flex items-center gap-1.5"
                  >
                    <ThumbsUp
                      size={14}
                      className={cn(
                        "transition-colors duration-200",
                        hasNominated && "fill-current text-brand-accent",
                      )}
                    />
                    <span className="hidden sm:inline">
                      {hasNominated ? "Nominated" : "Nominate"}
                    </span>
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </div>
        )}
        <ArrowRight
          size={14}
          className="text-brand-cyan group-hover:translate-x-0.5 transition-transform"
        />
      </div>
    </Link>
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

function getAvatarGradient(name: string): string {
  const gradients = [
    "from-brand-cyan to-brand-green",
    "from-brand-accent to-brand-cyan",
    "from-brand-green to-brand-accent",
    "from-purple-400 to-brand-cyan",
    "from-brand-cyan to-blue-500",
    "from-brand-green to-emerald-500",
    "from-brand-accent to-purple-500",
    "from-blue-400 to-brand-green",
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}
