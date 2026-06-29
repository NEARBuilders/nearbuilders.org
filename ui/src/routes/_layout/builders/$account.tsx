import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Profile } from "better-near-auth";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, MapPin, Pencil, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { ActivityFeed } from "@/components/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { socialIcon } from "@/components/ui/social-icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { activityFeedQueryOptions } from "@/lib/queries/activity";
import type { ProposalPayload } from "@/lib/queries/builders";
import {
  builderProposalsOptions,
  upvoteCountsOptions,
  userVotesOptions,
} from "@/lib/queries/builders";
import { linkLabel } from "@/lib/social-links";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_layout/builders/$account")({
  loader: async ({ params, context }) => {
    const { queryClient, apiClient, session } = context;
    const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);

    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["builder", params.account],
        queryFn: () => apiClient.getBuilder({ nearAccount: params.account }),
        retry: false,
      }),
      queryClient.prefetchQuery(builderProposalsOptions(apiClient, params.account)),
      queryClient.prefetchInfiniteQuery(
        activityFeedQueryOptions(apiClient, { actor: params.account }),
      ),
    ]);

    const proposalsData = queryClient.getQueryData(["proposals", "builders", params.account]) as
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
  head: ({ params }) => ({
    meta: [
      { title: `${params.account} | NEAR Builders` },
      {
        name: "description",
        content: `Builder profile for ${params.account} on NEAR Builders.`,
      },
    ],
  }),
  component: BuilderProfilePage,
});

type BuilderData = NonNullable<
  Awaited<ReturnType<ReturnType<typeof useApiClient>["builders"]["getBuilder"]>>["data"]
>;
type ProjectSummary = Awaited<
  ReturnType<ReturnType<typeof useApiClient>["listProjects"]>
>["data"][number];
type BuilderProfileTab = "projects" | "activity";

function BuilderProfilePage() {
  const { account } = Route.useParams();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const isAuthenticated = Boolean(session?.user && !session.user.isAnonymous);
  const navigate = useNavigate();

  const { data: builderResult, isLoading: builderLoading } = useQuery({
    queryKey: ["builder", account],
    queryFn: () => apiClient.getBuilder({ nearAccount: account }),
    retry: false,
  });

  const { data: proposalsData } = useQuery(builderProposalsOptions(apiClient, account));
  const proposals = proposalsData?.data ?? [];
  const activeProposal = proposals.find((p) => p.reviewStatus === "pending") ?? null;

  const proposalIds = proposals.map((p) => p.id);
  const { data: countsData } = useQuery(upvoteCountsOptions(apiClient, proposalIds));
  const { data: votesData } = useQuery(
    userVotesOptions(apiClient, proposalIds.length > 0 ? proposalIds : [], isAuthenticated),
  );
  const counts = countsData ?? {};
  const voteMap = votesData ?? {};

  const queryClient = useQueryClient();

  const upvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.upvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["upvoteCounts", proposalIds],
        (old: Record<string, { entityId: string; totalCount: number }> | undefined) => ({
          ...old,
          [data.entityId]: data,
        }),
      );
      queryClient.setQueryData(
        ["userVotes", proposalIds],
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
        ["upvoteCounts", proposalIds],
        (old: Record<string, { entityId: string; totalCount: number }> | undefined) => ({
          ...old,
          [data.entityId]: data,
        }),
      );
      queryClient.setQueryData(
        ["userVotes", proposalIds],
        (old: Record<string, { entityId: string; hasUpvote: boolean }> | undefined) => ({
          ...old,
          [data.entityId]: { entityId: data.entityId, hasUpvote: false },
        }),
      );
    },
  });

  const handleVote = (proposalId: string) => {
    if (!isAuthenticated) {
      void navigate({ to: "/login", search: { redirect: `/builders/${account}` } });
      return;
    }
    const entry = voteMap[proposalId];
    if (entry?.hasUpvote) {
      downvoteMutation.mutate(proposalId);
    } else {
      upvoteMutation.mutate(proposalId);
    }
  };

  if (builderLoading) return <ProfileSkeleton account={account} />;

  if (builderResult?.data) {
    return (
      <LoadedProfile
        account={account}
        builder={builderResult.data}
        activeProposal={activeProposal}
        nominationCount={
          activeProposal
            ? activeProposal.submissionCount + (counts[activeProposal.id]?.totalCount ?? 0)
            : null
        }
        hasNominated={activeProposal ? voteMap[activeProposal.id]?.hasUpvote === true : false}
        isVoting={
          activeProposal
            ? (upvoteMutation.isPending && upvoteMutation.variables === activeProposal.id) ||
              (downvoteMutation.isPending && downvoteMutation.variables === activeProposal.id)
            : false
        }
        onVote={activeProposal ? () => handleVote(activeProposal!.id) : undefined}
      />
    );
  }

  if (proposals.length > 0) {
    return (
      <NominatedFallback
        account={account}
        proposal={activeProposal ?? proposals[0]}
        nominationCount={
          activeProposal
            ? activeProposal.submissionCount + (counts[activeProposal.id]?.totalCount ?? 0)
            : proposals[0].submissionCount + (counts[proposals[0].id]?.totalCount ?? 0)
        }
        hasNominated={
          activeProposal
            ? voteMap[activeProposal.id]?.hasUpvote === true
            : voteMap[proposals[0].id]?.hasUpvote === true
        }
        isVoting={
          (upvoteMutation.isPending &&
            upvoteMutation.variables === (activeProposal ?? proposals[0]).id) ||
          (downvoteMutation.isPending &&
            downvoteMutation.variables === (activeProposal ?? proposals[0]).id)
        }
        onVote={() => handleVote((activeProposal ?? proposals[0]).id)}
        allProposals={proposals}
        counts={counts}
      />
    );
  }

  return <BuilderNotFound />;
}

function LoadedProfile({
  account,
  builder,
  activeProposal,
  nominationCount,
  hasNominated,
  isVoting,
  onVote,
}: {
  account: string;
  builder: BuilderData;
  activeProposal: { id: string; submissionCount: number } | null;
  nominationCount: number | null;
  hasNominated: boolean;
  isVoting: boolean;
  onVote: (() => void) | undefined;
}) {
  const auth = useAuthClient();
  const apiClient = useApiClient();
  const [activeTab, setActiveTab] = useState<BuilderProfileTab>("projects");
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const canEdit =
    session?.user?.role === "admin" ||
    (Boolean(nearAccountId) && nearAccountId?.toLowerCase() === account.toLowerCase());

  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["near-profile", account],
    queryFn: async () => {
      const res = await auth.near.getProfile(account);
      return res.data || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: projectsResult, isLoading: projectsLoading } = useQuery({
    queryKey: ["builder-projects", account],
    queryFn: () =>
      apiClient.listProjects({
        ownerId: account,
        visibility: "public",
        limit: 6,
      }),
  });

  const projects = projectsResult?.data ?? [];

  const displayName = builder.name || profile?.name || account;
  const bio = builder.bio || profile?.description || null;

  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);

  const backgroundUrl =
    profile?.backgroundImage?.url ??
    (profile?.backgroundImage?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${profile.backgroundImage.ipfs_cid}`
      : null);

  const allLinks: Record<string, string> = {};
  if (profile?.linktree) {
    for (const [k, v] of Object.entries(profile.linktree)) {
      if (typeof v === "string" && v.trim()) allLinks[k] = v;
    }
  }
  for (const [k, v] of Object.entries(builder.links ?? {})) {
    if (typeof v === "string" && v.trim()) allLinks[k] = v;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link
          to="/builders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          All builders
        </Link>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-8">
        <div className="relative h-40 sm:h-48">
          <div
            className="absolute inset-0"
            style={{
              background: backgroundUrl
                ? undefined
                : "radial-gradient(ellipse at top left, color-mix(in srgb, var(--brand-green) 25%, transparent), color-mix(in srgb, var(--brand-cyan) 15%, transparent))",
            }}
          />
          {backgroundUrl && (
            <img
              src={backgroundUrl}
              alt="Profile background"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          {canEdit && (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="absolute right-4 top-4 gap-1.5 rounded-full border border-border bg-card/80 backdrop-blur-sm hover:bg-card"
            >
              <Link to="/builders/$account/edit" params={{ account }}>
                <Pencil size={13} />
                Edit profile
              </Link>
            </Button>
          )}
          <div className="absolute -bottom-10 left-6 sm:left-8">
            <div className="size-20 rounded-full overflow-hidden bg-muted border-4 border-card flex items-center justify-center shadow-lg">
              {profileLoading ? (
                <Skeleton className="size-20 rounded-full" />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="size-20 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="text-2xl font-black text-muted-foreground">
                  {getInitials(displayName)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-14 px-6 sm:px-8 pb-8">
          {profileLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black text-foreground leading-tight">
                    {displayName}
                  </h1>
                  {activeProposal && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-accent-light text-brand-accent border-brand-accent/20"
                    >
                      Nominated
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-mono text-brand-cyan mt-1">{account}</p>
                {builder.location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                    <MapPin size={13} />
                    {builder.location}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {activeProposal && nominationCount !== null && onVote && (
                  <div className="flex items-center gap-2">
                    <motion.span
                      key={`count-${nominationCount}`}
                      initial={{ scale: 1.15 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="text-sm font-bold text-muted-foreground tabular-nums"
                    >
                      {nominationCount} nomination{nominationCount !== 1 ? "s" : ""}
                    </motion.span>
                    <motion.div
                      whileTap={{ scale: 1.15 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Button
                        variant={hasNominated ? "secondary" : "outline"}
                        size="sm"
                        onClick={onVote}
                        disabled={isVoting}
                        className={cn(
                          "gap-1.5 rounded-full text-xs h-8 px-3",
                          hasNominated &&
                            "border-brand-accent bg-brand-accent-light text-foreground",
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
                            {hasNominated ? "Nominated" : "Nominate"}
                          </motion.span>
                        </AnimatePresence>
                      </Button>
                    </motion.div>
                  </div>
                )}
                {Object.keys(allLinks).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(allLinks).map(([platform, url]) => {
                      const Icon = socialIcon(platform);
                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-secondary border border-border hover:bg-muted hover:border-border/80 transition-all duration-150 font-medium"
                        >
                          <Icon className="size-3.5" />
                          {linkLabel(platform)}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {bio && (
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-2xl">{bio}</p>
          )}

          {builder.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-5">
              {builder.skills.map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="text-xs px-3 py-1 rounded-full font-medium"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as BuilderProfileTab)}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="projects">
          <ProjectsTabContent
            projectsLoading={projectsLoading}
            projects={projects}
            hasMore={projectsResult?.meta.hasMore ?? false}
          />
        </TabsContent>
        <TabsContent value="activity">
          <TooltipProvider>
            <ActivityFeed
              filters={{ actor: account }}
              emptyHint={`${displayName} has no activity yet.`}
            />
          </TooltipProvider>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectsTabContent({
  projectsLoading,
  projects,
  hasMore,
}: {
  projectsLoading: boolean;
  projects: ProjectSummary[];
  hasMore: boolean;
}) {
  if (projectsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-secondary h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">No public projects yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            to="/projects/$kind/$slug"
            params={{ kind: project.kind, slug: project.slug }}
            className="group bg-card border border-border rounded-xl px-5 py-4 hover:border-border/80 hover:shadow-md transition-all duration-150 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate flex-1 group-hover:text-brand-cyan transition-colors">
                {project.title}
              </span>
              <span className="text-[10px] font-semibold border border-border rounded-[4px] px-1.5 py-0.5 text-muted-foreground shrink-0">
                {project.kind}
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground truncate">{project.description}</p>
            )}
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="mt-4">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/projects" search={{ kind: "all", personal: undefined, private: undefined }}>
              View all projects
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

function NominatedFallback({
  account,
  proposal,
  nominationCount,
  hasNominated,
  isVoting,
  onVote,
  allProposals,
  counts,
}: {
  account: string;
  proposal: {
    id: string;
    entityId: string;
    reviewStatus: string;
    submissionCount: number;
    createdAt: string;
    payload: unknown;
  };
  nominationCount: number;
  hasNominated: boolean;
  isVoting: boolean;
  onVote: () => void;
  allProposals: {
    id: string;
    reviewStatus: string;
    submissionCount: number;
    createdAt: string;
    payload: unknown;
  }[];
  counts: Record<string, { entityId: string; totalCount: number }>;
}) {
  const auth = useAuthClient();

  const { data: profile, isLoading: profileLoading } = useQuery<Profile | null>({
    queryKey: ["near-profile", account],
    queryFn: async () => {
      const res = await auth.near.getProfile(account);
      return res.data || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const raw = proposal.payload;
  const payload: ProposalPayload =
    typeof raw === "object" && raw !== null ? (raw as ProposalPayload) : {};

  const displayName = payload.name || profile?.name || account;
  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);
  const bio = payload.bio || profile?.description || null;
  const skills: string[] = Array.isArray(payload.skills) ? payload.skills : [];
  const location = payload.location || null;

  const backgroundUrl =
    profile?.backgroundImage?.url ??
    (profile?.backgroundImage?.ipfs_cid
      ? `https://ipfs.near.social/ipfs/${profile.backgroundImage.ipfs_cid}`
      : null);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link
          to="/builders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          All builders
        </Link>
      </div>

      <div className="bg-card border border-border border-dashed rounded-2xl overflow-hidden mb-8">
        <div className="relative h-40 sm:h-48">
          <div
            className="absolute inset-0"
            style={{
              background: backgroundUrl
                ? undefined
                : "radial-gradient(ellipse at top left, color-mix(in srgb, var(--brand-accent) 20%, transparent), color-mix(in srgb, var(--brand-cyan) 15%, transparent))",
            }}
          />
          {backgroundUrl && (
            <img
              src={backgroundUrl}
              alt="Profile background"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="absolute -bottom-10 left-6 sm:left-8">
            <div className="size-20 rounded-full overflow-hidden bg-muted border-4 border-card border-dashed flex items-center justify-center shadow-lg">
              {profileLoading ? (
                <Skeleton className="size-20 rounded-full" />
              ) : avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="size-20 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <span className="text-2xl font-black text-muted-foreground">
                  {getInitials(displayName)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-14 px-6 sm:px-8 pb-8">
          {profileLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black text-foreground leading-tight">
                    {displayName}
                  </h1>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-brand-accent-light text-brand-accent border-brand-accent/20"
                  >
                    Nominated
                  </Badge>
                </div>
                <p className="text-sm font-mono text-brand-cyan mt-1">{account}</p>
                {location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                    <MapPin size={13} />
                    {location}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <motion.span
                  key={`count-${nominationCount}`}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="text-sm font-bold text-muted-foreground tabular-nums"
                >
                  {nominationCount} nomination{nominationCount !== 1 ? "s" : ""}
                </motion.span>
                <motion.div
                  whileTap={{ scale: 1.15 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button
                    variant={hasNominated ? "secondary" : "outline"}
                    size="sm"
                    onClick={onVote}
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
                        {hasNominated ? "Nominated" : "Nominate"}
                      </motion.span>
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </div>
            </div>
          )}

          {bio && (
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-2xl">{bio}</p>
          )}

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-5">
              {skills.map((skill) => (
                <Badge
                  key={skill}
                  variant="secondary"
                  className="text-xs px-3 py-1 rounded-full font-medium"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl bg-muted/40 border border-border border-dashed px-5 py-4">
            <p className="text-sm text-muted-foreground">
              This builder has been nominated but hasn't been approved yet. Support their nomination
              to help them get recognized.
            </p>
          </div>
        </div>
      </div>

      {allProposals.length > 1 && (
        <section>
          <h2 className="text-xl font-black text-foreground mb-5">Nomination history</h2>
          <div className="space-y-2">
            {allProposals.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {p.reviewStatus === "pending"
                      ? "Pending review"
                      : p.reviewStatus.charAt(0).toUpperCase() + p.reviewStatus.slice(1)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground tabular-nums">
                    {p.submissionCount + (counts[p.id]?.totalCount ?? 0)} nomination
                    {p.submissionCount + (counts[p.id]?.totalCount ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <Badge
                    variant={p.reviewStatus === "pending" ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      p.reviewStatus === "pending" &&
                        "bg-brand-accent-light text-brand-accent border-brand-accent/20",
                      p.reviewStatus === "approved" &&
                        "bg-green-100 text-green-800 border-green-200",
                      p.reviewStatus === "rejected" && "bg-red-100 text-red-800 border-red-200",
                    )}
                  >
                    {p.reviewStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProfileSkeleton({ account }: { account: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <Link
          to="/builders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          All builders
        </Link>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden mb-8">
        <Skeleton className="h-40 sm:h-48 w-full rounded-none" />
        <div className="pt-14 px-6 sm:px-8 pb-8 space-y-3">
          <Skeleton className="h-8 w-48" />
          <p className="text-sm font-mono text-brand-cyan">{account}</p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

function BuilderNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="text-5xl mb-6">🔍</div>
        <h1 className="text-2xl font-black text-foreground mb-2">Builder not found</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-sm leading-relaxed">
          This builder profile doesn't exist or hasn't been approved yet.
        </p>
        <Button asChild className="rounded-full px-6">
          <Link to="/builders">Browse builders</Link>
        </Button>
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
