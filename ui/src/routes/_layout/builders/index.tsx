import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LayoutGrid,
  List,
  MapPin,
  Search,
  SearchX,
  Sparkles,
  ThumbsUp,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sessionQueryOptions, useApiClient, useAuthClient, useOrpc } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Proposal, ProposalPayload } from "@/lib/queries/builders";
import {
  buildersInfiniteOptions,
  ensureNearProfiles,
  getBuilderCategoryCounts,
  nearProfileOptions,
  pendingProposalsOptions,
  upvoteCountsOptions,
  userVotesOptions,
} from "@/lib/queries/builders";
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
type BuilderLayout = "grid" | "list";

const BUILDER_LAYOUT_STORAGE_KEY = "near-builders-directory-layout";

type BuilderCardData =
  | { kind: "builder"; builder: BuilderLike; proposal: Proposal | null }
  | { kind: "nominated"; proposal: Proposal; payload: ProposalPayload };

function matchesBuilderSearch(card: BuilderCardData, search: string): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return true;

  const values =
    card.kind === "builder"
      ? [
          card.builder.nearAccount,
          card.builder.name,
          card.builder.bio,
          card.builder.location,
          ...card.builder.skills,
        ]
      : [
          card.proposal.entityId,
          card.payload.name,
          card.payload.bio,
          card.payload.location,
          ...(Array.isArray(card.payload.skills) ? card.payload.skills : []),
        ];

  return values.some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
}

export const Route = createFileRoute("/_layout/builders/")({
  loader: async ({ context }) => {
    const { queryClient, apiClient, session, authClient } = context;
    const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

    await queryClient.prefetchInfiniteQuery(buildersInfiniteOptions(apiClient, ""));

    const proposalsResult = await queryClient
      .fetchQuery(pendingProposalsOptions(apiClient))
      .catch(() => {
        queryClient.resetQueries({ queryKey: ["proposals", "builders", "pending"] });
        return null;
      });

    const proposalsData = proposalsResult as { data?: { id: string; entityId: string }[] } | null;
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

    const buildersData = queryClient.getQueryData(["builders", ""]) as
      | { pages: { data: { nearAccount: string }[] }[] }
      | undefined;
    const builderAccounts =
      buildersData?.pages?.flatMap((p) => p.data.map((b) => b.nearAccount)) ?? [];
    const proposalAccounts = proposalsData?.data?.map((p) => p.entityId) ?? [];
    ensureNearProfiles(queryClient, authClient, [...builderAccounts, ...proposalAccounts]).catch(
      (err) => {
        console.warn("[builders] failed to prefetch NEAR profiles:", err);
      },
    );
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
  const [skill, setSkill] = useState("all");
  const [location, setLocation] = useState("all");
  const [layout, setLayout] = useState<BuilderLayout>("grid");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  useEffect(() => {
    const storedLayout = localStorage.getItem(BUILDER_LAYOUT_STORAGE_KEY);
    if (storedLayout === "grid" || storedLayout === "list") setLayout(storedLayout);
  }, []);

  const updateLayout = (nextLayout: BuilderLayout) => {
    setLayout(nextLayout);
    localStorage.setItem(BUILDER_LAYOUT_STORAGE_KEY, nextLayout);
  };

  const {
    data: infiniteData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    ...buildersInfiniteOptions(apiClient, debouncedQuery),
    placeholderData: keepPreviousData,
  });

  const builders = useMemo(() => infiniteData?.pages.flatMap((p) => p.data) ?? [], [infiniteData]);

  const {
    data: proposalsData,
    isLoading: proposalsLoading,
    isError: proposalsError,
  } = useQuery(pendingProposalsOptions(apiClient));
  const proposals = proposalsData?.data ?? [];

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

  const skillOptions = useMemo(
    () =>
      Array.from(
        new Set(
          mergedCards.flatMap((card) =>
            card.kind === "builder"
              ? card.builder.skills
              : Array.isArray(card.payload.skills)
                ? card.payload.skills
                : [],
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [mergedCards],
  );

  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          mergedCards
            .map((card) =>
              card.kind === "builder" ? card.builder.location : card.payload.location,
            )
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [mergedCards],
  );

  const filteredCards = useMemo(() => {
    return sortedCards.filter((card) => {
      const matchesSearch = matchesBuilderSearch(card, debouncedQuery);
      const matchesCategory =
        category === "all" ||
        (category === "approved" ? card.kind === "builder" : card.kind === "nominated");
      const cardSkills =
        card.kind === "builder"
          ? card.builder.skills
          : Array.isArray(card.payload.skills)
            ? card.payload.skills
            : [];
      const cardLocation =
        card.kind === "builder" ? card.builder.location : card.payload.location || null;
      return (
        matchesSearch &&
        matchesCategory &&
        (skill === "all" || cardSkills.includes(skill)) &&
        (location === "all" || cardLocation === location)
      );
    });
  }, [sortedCards, debouncedQuery, category, skill, location]);

  const categoryCounts = useMemo(() => {
    if (!debouncedQuery) {
      return getBuilderCategoryCounts(
        infiniteData?.pages[0]?.meta.total ?? 0,
        proposalsData?.meta.total ?? 0,
      );
    }

    const matchingCards = mergedCards.filter((card) => matchesBuilderSearch(card, debouncedQuery));
    return getBuilderCategoryCounts(
      matchingCards.filter((card) => card.kind === "builder").length,
      matchingCards.filter((card) => card.kind === "nominated").length,
    );
  }, [debouncedQuery, infiniteData, mergedCards, proposalsData]);

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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight text-foreground">Builders</h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          Meet the people building on NEAR, explore their work, and find your next collaborator.
        </p>
      </header>

      <div className="mt-7 max-w-4xl">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search builders"
            placeholder="Search by name, skill, or location"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 rounded-xl bg-card pl-11 text-base"
          />
        </div>

        <div
          className="mt-5 flex justify-between border-b border-border sm:justify-start"
          role="tablist"
          aria-label="Builder status"
        >
          {(
            [
              { value: "all" as const, label: "All", icon: Users },
              { value: "approved" as const, label: "Approved", icon: CheckCircle2 },
              { value: "nominated" as const, label: "Nominations", icon: Sparkles },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                "relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1.5 py-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:pb-3 sm:pt-0 sm:text-sm",
                category === value
                  ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="hidden size-4 sm:block" />
              {label}
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-xs tabular-nums text-secondary-foreground sm:px-2">
                {categoryCounts[value]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="min-w-0 sm:w-auto">
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger
                className="h-11 min-h-11 w-full cursor-pointer rounded-xl bg-card px-3 sm:h-10 sm:min-h-10 sm:w-auto sm:rounded-full"
                aria-label="Filter by skill"
              >
                <SelectValue placeholder="All skills" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all" className="cursor-pointer">
                  All skills
                </SelectItem>
                {skillOptions.map((option) => (
                  <SelectItem key={option} value={option} className="cursor-pointer">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 sm:w-auto">
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger
                className="h-11 min-h-11 w-full cursor-pointer rounded-xl bg-card px-3 sm:h-10 sm:min-h-10 sm:w-auto sm:rounded-full"
                aria-label="Filter by location"
              >
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all" className="cursor-pointer">
                  All locations
                </SelectItem>
                {locationOptions.map((option) => (
                  <SelectItem key={option} value={option} className="cursor-pointer">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="ml-auto hidden items-center rounded-xl border border-border bg-card p-1 sm:inline-flex">
            <legend className="sr-only">Builder layout</legend>
            <Button
              type="button"
              variant={layout === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Grid view"
              aria-pressed={layout === "grid"}
              title="Grid view"
              onClick={() => updateLayout("grid")}
              className="rounded-lg"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              type="button"
              variant={layout === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="List view"
              aria-pressed={layout === "list"}
              title="List view"
              onClick={() => updateLayout("list")}
              className="rounded-lg"
            >
              <List className="size-4" />
            </Button>
          </fieldset>
        </div>
      </div>

      <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {category === "all"
                  ? "All builders"
                  : category === "approved"
                    ? "Approved builders"
                    : "Community nominations"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {category === "all"
                  ? "Explore approved builders and community nominations together."
                  : category === "approved"
                    ? "Builder profiles recognized by the NEAR Builders community."
                    : "Support promising builders while their profiles are under review."}
              </p>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {filteredCards.length} shown
            </span>
          </div>

          {isLoading || proposalsLoading ? (
            <div className={cn("grid gap-4", layout === "grid" && "sm:grid-cols-2")}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "animate-pulse rounded-xl bg-secondary",
                    layout === "grid" ? "h-72" : "h-32",
                  )}
                />
              ))}
            </div>
          ) : isError || proposalsError ? (
            <StatusPanel
              icon={CircleAlert}
              title="Unable to load builders"
              description="The builder directory is temporarily unavailable. Please try again shortly."
            />
          ) : filteredCards.length === 0 ? (
            <StatusPanel
              icon={SearchX}
              title="No builders found"
              description={
                debouncedQuery || skill !== "all" || location !== "all"
                  ? "Try clearing a filter or searching for something else."
                  : category === "all"
                    ? "No builders or nominations are available yet."
                    : category === "approved"
                      ? "No approved builders are available yet."
                      : "There are no pending nominations right now."
              }
            />
          ) : (
            <>
              <div
                className={cn("grid gap-4", layout === "grid" ? "sm:grid-cols-2" : "grid-cols-1")}
              >
                {filteredCards.map((card) => {
                  const proposal = card.proposal;
                  const nominationCount = proposal
                    ? proposal.submissionCount + (counts[proposal.id]?.totalCount ?? 0)
                    : null;
                  const hasNominated = proposal ? voteMap[proposal.id]?.hasUpvote === true : false;
                  const isVoting = proposal
                    ? (upvoteMutation.isPending && upvoteMutation.variables === proposal.id) ||
                      (downvoteMutation.isPending && downvoteMutation.variables === proposal.id)
                    : false;
                  const onVote = proposal ? () => handleVote(proposal.id) : undefined;

                  if (card.kind === "builder") {
                    return (
                      <BuilderCard
                        key={card.builder.id}
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
                        isNominated={false}
                        layout={layout}
                      />
                    );
                  }

                  return (
                    <BuilderCard
                      key={card.proposal.id}
                      nearAccount={card.proposal.entityId}
                      displayNameOverride={card.payload.name || card.proposal.entityId}
                      bioOverride={card.payload.bio || null}
                      skillsOverride={Array.isArray(card.payload.skills) ? card.payload.skills : []}
                      locationOverride={card.payload.location || null}
                      proposal={proposal}
                      nominationCount={nominationCount ?? 0}
                      hasNominated={hasNominated}
                      isVoting={isVoting}
                      onVote={onVote}
                      auth={auth}
                      isNominated
                      layout={layout}
                    />
                  );
                })}
              </div>
              <div ref={sentinelRef} className="flex justify-center py-8">
                {isFetchingNextPage && (
                  <div className="size-5 animate-spin rounded-full border-2 border-border border-t-brand-accent" />
                )}
              </div>
            </>
          )}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <BuilderActionCard
            icon={WalletCards}
            title="Build on NEAR"
            description={
              isAuthenticated
                ? "Claim your profile and help collaborators discover your work."
                : "Connect your NEAR wallet and join the builder directory."
            }
            label={isAuthenticated ? "Open your dashboard" : "Connect your wallet"}
            to={isAuthenticated ? "/dashboard" : "/login"}
          />
          <BuilderActionCard
            icon={UserPlus}
            title="Nominate someone"
            description="Recognize a builder who is making an impact in the NEAR ecosystem."
            label="Nominate a builder"
            to="/builders/add"
          />
        </aside>
      </div>
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CircleAlert;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-border bg-card px-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function BuilderActionCard({
  icon: Icon,
  title,
  description,
  label,
  to,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  label: string;
  to: "/dashboard" | "/login" | "/builders/add";
}) {
  return (
    <section className="rounded-xl border border-brand-accent-border bg-brand-accent-light p-5">
      <div className="flex size-10 items-center justify-center rounded-full bg-card text-brand-accent shadow-sm">
        <Icon className="size-5" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Link
        to={to}
        className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-brand-accent"
      >
        {label}
        <ArrowRight className="size-4" />
      </Link>
    </section>
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
  layout,
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
  layout: BuilderLayout;
}) {
  const { data: profile, isLoading } = useQuery<Profile | null>(
    nearProfileOptions(auth, nearAccount),
  );

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
        "group relative flex min-h-72 flex-col rounded-xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent-border hover:shadow-md",
        layout === "list" && "sm:min-h-0 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
        isNominated ? "border border-dashed border-border" : "border border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="size-14 rounded-full overflow-hidden shrink-0 bg-muted flex items-center justify-center">
          {isLoading ? (
            <div className="size-14 rounded-full bg-muted animate-pulse" />
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={resolvedName}
              className="size-14 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex size-14 items-center justify-center bg-brand-accent-light font-bold text-brand-accent">
              <span className="text-base">{getInitials(resolvedName)}</span>
            </div>
          )}
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            layout === "list" && "sm:absolute sm:right-4 sm:top-4",
            isNominated
              ? "border-brand-accent-border bg-brand-accent-light text-brand-accent"
              : "text-muted-foreground",
          )}
        >
          {isNominated ? <Sparkles className="size-3" /> : <CheckCircle2 className="size-3" />}
          {isNominated ? "Nominated" : "Approved"}
        </Badge>
      </div>

      <div className={cn("mt-4 min-w-0", layout === "list" && "sm:mt-0 sm:flex-1 sm:pr-28")}>
        <div className={cn("min-w-0", layout === "list" && "sm:flex sm:items-baseline sm:gap-2")}>
          <h3 className="truncate text-lg font-bold text-foreground">{resolvedName}</h3>
          <p
            className={cn(
              "mt-0.5 truncate font-mono text-xs text-brand-cyan",
              layout === "list" && "sm:mt-0 sm:shrink",
            )}
          >
            {nearAccount}
          </p>
        </div>
        {resolvedBio ? (
          <p
            className={cn(
              "mt-3 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground",
              layout === "list" && "sm:mt-2 sm:line-clamp-1 sm:min-h-0",
            )}
          >
            {resolvedBio}
          </p>
        ) : (
          <p
            className={cn(
              "mt-3 min-h-10 text-sm text-muted-foreground",
              layout === "list" && "sm:mt-2 sm:min-h-0 sm:truncate",
            )}
          >
            Explore this builder's profile and work across the NEAR ecosystem.
          </p>
        )}
        <div
          className={cn(
            layout === "list" && "sm:mt-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2",
          )}
        >
          {resolvedLocation && (
            <div
              className={cn(
                "mt-3 flex items-center gap-1.5 text-xs text-muted-foreground",
                layout === "list" && "sm:mt-0",
              )}
            >
              <MapPin className="size-3.5" />
              <span className="truncate">{resolvedLocation}</span>
            </div>
          )}
          {resolvedSkills.length > 0 && (
            <div
              className={cn(
                "mb-4 mt-3 flex flex-wrap gap-1.5",
                layout === "list" && "sm:mb-0 sm:mt-0",
              )}
            >
              {resolvedSkills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary" className="rounded-full text-[10px]">
                  {skill}
                </Badge>
              ))}
              {resolvedSkills.length > 3 && (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  +{resolvedSkills.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {showVoteButton && (
        <div
          className={cn(
            "mt-auto flex items-center justify-between gap-3 border-t border-border pt-4",
            layout === "list" &&
              "sm:mt-0 sm:w-36 sm:shrink-0 sm:self-stretch sm:flex-col sm:items-end sm:justify-end sm:border-t-0 sm:pt-10",
          )}
        >
          <div className="flex items-center gap-2">
            <motion.span
              key={`count-${proposal!.id}-${nominationCount}`}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={cn(
                "text-sm font-bold text-muted-foreground tabular-nums",
                layout === "list" && "sm:hidden",
              )}
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
                  "h-8 gap-1.5 rounded-full px-3 text-xs",
                  layout === "list" &&
                    "sm:min-w-28 sm:border-brand-accent-border sm:bg-brand-accent-light sm:hover:border-brand-accent",
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
                    <span className={cn(layout === "grid" && "hidden sm:inline")}>
                      {hasNominated ? "Nominated" : "Nominate"}
                    </span>
                    {layout === "list" && (
                      <span className="hidden border-l border-brand-accent-border pl-1.5 font-bold tabular-nums text-muted-foreground sm:inline">
                        {nominationCount}
                      </span>
                    )}
                  </motion.span>
                </AnimatePresence>
              </Button>
            </motion.div>
          </div>
          <ArrowRight
            className={cn(
              "ml-auto size-4 text-brand-cyan transition-transform group-hover:translate-x-0.5",
              layout === "list" && "sm:hidden",
            )}
          />
        </div>
      )}
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
