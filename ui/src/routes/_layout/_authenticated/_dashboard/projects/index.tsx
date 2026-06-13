import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Reorder } from "framer-motion";
import {
  ArrowUpRight,
  BarChart2,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  Layers,
  Lock,
  Pencil,
  Plus,
  Share2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient, useOrpc } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { VoteButton } from "@/components/ui/vote-button";
import { fetchRepositoryReadme } from "@/lib/repository-content";
import { cn } from "@/lib/utils";
import { type ProjectKindFilter, parseProjectListSearch } from "./-search";

type VoteDirection = "up" | "down" | null;

type ProjectKind = "project" | "idea" | "scope" | "result";

interface RankedProject {
  id: string;
  ownerId: string;
  organizationId: string | null;
  kind: ProjectKind;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  status: "active" | "paused" | "archived";
  visibility: "private" | "unlisted" | "public";
  repository: string | null;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
  upvoteCount: number;
}

const PAGE_SIZE = 24;

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/projects/")({
  validateSearch: parseProjectListSearch,
  head: () => ({
    meta: [
      { title: "Projects | app" },
      { name: "description", content: "Browse projects and ideas, ranked live by votes." },
    ],
  }),
  loaderDeps: ({ search }) => ({
    kind: search.kind,
    personal: search.personal,
    private: search.private,
  }),
  loader: ({ context, deps }) => {
    const { queryClient, apiClient } = context;
    const { kind, personal } = deps;
    const activeKind =
      kind === "project" ||
      kind === "idea" ||
      kind === "scope" ||
      kind === "result" ||
      kind === "all"
        ? kind
        : "all";

    if (personal) return;

    void queryClient.prefetchInfiniteQuery({
      queryKey: ["projects", activeKind, null, false],
      queryFn: ({ pageParam }) =>
        apiClient.listProjects({
          limit: PAGE_SIZE,
          cursor: pageParam as string | undefined,
          kind: activeKind === "all" ? undefined : activeKind,
        }),
      initialPageParam: undefined,
    });
  },
  component: ProjectsList,
});

function isGithubUrl(url: string) {
  return /github\.com/i.test(url);
}

function GithubIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.165c-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.52 11.52 0 0 1 12 6.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.218.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function isCurrentUserOwner(
  ownerId: string | null | undefined,
  user:
    | { id?: string | null; walletAddress?: string | null; role?: string | null }
    | null
    | undefined,
  nearAccountId?: string | null,
) {
  if (!ownerId) return false;
  return [nearAccountId, user?.walletAddress, user?.id].some((candidate) => candidate === ownerId);
}

function ProjectsList() {
  const apiClient = useApiClient();
  const orpc = useOrpc();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const search = Route.useSearch();
  const activeKind =
    search.kind === "project" ||
    search.kind === "idea" ||
    search.kind === "scope" ||
    search.kind === "result" ||
    search.kind === "all"
      ? search.kind
      : "all";
  const isPersonalOnly = search.personal === true;
  const isPrivateOnly = isPersonalOnly && search.private === true;

  const sessionQuery = useQuery(sessionQueryOptions(auth, undefined));
  const { data: session } = sessionQuery;
  const user = session?.user;
  const userId = user?.id;
  const nearAccountId = auth.near.getAccountId();
  const ownerFilterId =
    nearAccountId ??
    (user as { walletAddress?: string | null } | undefined)?.walletAddress ??
    user?.id;
  const canParticipate = Boolean(user && !user.isAnonymous);
  const [copied, setCopied] = useState(false);
  const listQueryKey = useMemo(
    () =>
      [
        "projects",
        activeKind,
        isPersonalOnly ? (ownerFilterId ?? null) : null,
        isPrivateOnly,
      ] as const,
    [activeKind, isPersonalOnly, isPrivateOnly, ownerFilterId],
  );

  const handleShare = useCallback((projectId: string, projectKind: ProjectKind) => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/projects/${projectKind}/${projectId}`
        : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const {
    data: pages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: listQueryKey,
    queryFn: ({ pageParam }) =>
      apiClient.listProjects({
        limit: PAGE_SIZE,
        cursor: pageParam,
        kind: activeKind === "all" ? undefined : activeKind,
        ownerId: isPersonalOnly ? ownerFilterId : undefined,
        visibility: isPrivateOnly ? "private" : undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined),
    enabled: !isPersonalOnly || Boolean(ownerFilterId),
  });

  const projects = useMemo(() => pages?.pages.flatMap((page) => page.data) ?? [], [pages]);
  const projectIdList = useMemo(() => projects.map((p) => p.id), [projects]);

  const upvoteCounts = useQuery({
    queryKey: ["upvoteCounts", projectIdList],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        projects.map(async (p) => {
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
    enabled: projects.length > 0,
  });

  const counts = upvoteCounts.data ?? {};
  const rankedProjects = useMemo<RankedProject[]>(() => {
    return projects
      .map((p) => ({ ...p, upvoteCount: counts[p.id] ?? 0 }))
      .sort((a, b) => b.upvoteCount - a.upvoteCount);
  }, [projects, counts]);
  const projectIds = useMemo(() => rankedProjects.map((p) => p.id), [rankedProjects]);

  const userVoteStates = useQuery({
    queryKey: ["userVoteStates", projectIdList],
    queryFn: async () => {
      const votes: Record<string, VoteDirection> = {};
      await Promise.all(
        projects.map(async (p) => {
          try {
            const result = await apiClient.getUserVote({ entityId: p.id });
            votes[p.id] = result.hasUpvote ? "up" : null;
          } catch {
            votes[p.id] = null;
          }
        }),
      );
      return votes;
    },
    enabled: canParticipate && projects.length > 0,
  });

  const userVoteMap = userVoteStates.data ?? {};

  const { data: latestVote } = useQuery(
    orpc.subscribeUpvotes.experimental_liveOptions({ retry: true }),
  );

  useEffect(() => {
    if (!latestVote) return;
    const { entityId: latestEntityId, totalCount, type } = latestVote;
    queryClient.setQueryData(
      ["upvoteCounts", projectIds],
      (old: Record<string, number> | undefined) => ({ ...old, [latestEntityId]: totalCount }),
    );
    if (userId && latestVote.userId === userId) {
      queryClient.setQueryData(
        ["userVoteStates", projectIds],
        (old: Record<string, VoteDirection> | undefined) => ({
          ...old,
          [latestEntityId]: type === "downvote" ? "down" : "up",
        }),
      );
    }
  }, [latestVote, queryClient, projectIds, userId]);

  const selectedProjectId =
    rankedProjects.find((p) => p.id === search.preview)?.id ?? rankedProjects[0]?.id;

  const selectedProjectQuery = useQuery({
    queryKey: ["project", selectedProjectId],
    queryFn: () => apiClient.getProject({ id: selectedProjectId! }),
    enabled: Boolean(selectedProjectId),
  });

  const selectedProject = selectedProjectQuery.data?.data;

  const isAdminUser = user?.role === "admin";
  const canManageSelected =
    isAdminUser || isCurrentUserOwner(selectedProject?.ownerId, user, nearAccountId);

  const selectedReadmeQuery = useQuery({
    queryKey: ["projectPreviewReadme", selectedProject?.id, selectedProject?.repository],
    queryFn: async () => {
      if (!selectedProject?.repository) return null;
      return await fetchRepositoryReadme(selectedProject.repository);
    },
    enabled: selectedProject?.kind === "project" && Boolean(selectedProject?.repository),
  });

  const upvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.upvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["upvoteCounts", projectIds],
        (old: Record<string, number> | undefined) => ({ ...old, [data.entityId]: data.totalCount }),
      );
      queryClient.setQueryData(
        ["userVoteStates", projectIds],
        (old: Record<string, VoteDirection> | undefined) => ({ ...old, [data.entityId]: "up" }),
      );
    },
    onError: (err: Error) => toast.error(err.message || "Failed to upvote"),
  });

  const downvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.downvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["upvoteCounts", projectIds],
        (old: Record<string, number> | undefined) => ({ ...old, [data.entityId]: data.totalCount }),
      );
      queryClient.setQueryData(
        ["userVoteStates", projectIds],
        (old: Record<string, VoteDirection> | undefined) => ({ ...old, [data.entityId]: "down" }),
      );
    },
    onError: (err: Error) => toast.error(err.message || "Failed to downvote"),
  });

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

  const handleMobileRowTap = (projectId: string, kind: ProjectKind) => {
    void navigate({
      to: "/projects/$kind/$id",
      params: { kind, id: projectId },
      search: {
        kind: search.kind,
        personal: search.personal,
        private: search.private,
      },
    });
  };

  const handleDesktopRowSelect = (projectId: string) => {
    void navigate({
      to: "/projects",
      search: (prev) => ({
        ...prev,
        preview: projectId,
        kind: search.kind,
        personal: search.personal,
        private: search.private,
      }),
    });
  };

  const handleKindChange = (kind: ProjectKindFilter) => {
    void navigate({
      to: "/projects",
      search: () => ({
        kind,
        preview: undefined,
        personal: search.personal,
        private: search.private,
      }),
    });
  };

  const handlePersonalToggle = () => {
    const nextPersonal = !isPersonalOnly;
    void navigate({
      to: "/projects",
      search: () => ({
        kind: search.kind,
        preview: undefined,
        personal: nextPersonal || undefined,
        private: nextPersonal ? search.private : undefined,
      }),
    });
  };

  const handlePrivateToggle = () => {
    if (!isPersonalOnly) return;
    void navigate({
      to: "/projects",
      search: () => ({
        kind: search.kind,
        preview: undefined,
        personal: true,
        private: isPrivateOnly ? undefined : true,
      }),
    });
  };

  const runVote = (direction: "up" | "down", projectId: string) => {
    if (!canParticipate) {
      toast.error("Link an identity in settings before voting.");
      return;
    }
    if (direction === "up") upvoteMutation.mutate(projectId);
    else downvoteMutation.mutate(projectId);
  };

  const previewContent =
    selectedProject?.kind === "idea" ||
    selectedProject?.kind === "scope" ||
    selectedProject?.kind === "result"
      ? selectedProject.content
      : (selectedReadmeQuery.data ?? selectedProject?.description ?? null);

  const toggleChip =
    "h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer transition-colors border inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

  const filterButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
        {(
          [
            { value: "all", label: "All" },
            { value: "idea", label: "Ideas" },
            { value: "project", label: "Projects" },
            { value: "scope", label: "Scopes" },
            { value: "result", label: "Results" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleKindChange(opt.value)}
            className={cn(
              "h-7 px-3 rounded-md text-sm font-semibold cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              activeKind === opt.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handlePersonalToggle}
        className={cn(
          toggleChip,
          isPersonalOnly
            ? "border-brand-accent bg-brand-accent-light text-foreground"
            : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
        )}
      >
        <User size={13} />
        Personal
      </button>

      {isPersonalOnly && (
        <button
          type="button"
          onClick={handlePrivateToggle}
          className={cn(
            toggleChip,
            isPrivateOnly
              ? "border-brand-accent bg-brand-accent-light text-foreground"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          <Lock size={13} />
          Private
        </button>
      )}
    </div>
  );

  const defaultNewKind = activeKind !== "all" && activeKind !== undefined ? activeKind : "project";
  const newButton = canParticipate ? (
    <Button asChild size="sm">
      <Link
        to="/projects/new/$kind"
        params={{ kind: defaultNewKind }}
        search={{
          tab: "write",
          kind: search.kind,
          personal: search.personal,
          private: search.private,
        }}
      >
        <Plus size={14} />
        New
      </Link>
    </Button>
  ) : (
    <Button size="sm" disabled>
      <Plus size={14} />
      New
    </Button>
  );

  const projectList = (
    <div className="flex flex-col overflow-hidden flex-1 min-h-0">
      {isLoading ? (
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-3.5 py-3">
              <div className="hidden lg:block size-4 shrink-0 rounded bg-secondary animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-1/2 rounded bg-secondary animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-secondary animate-pulse" />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div className="size-5 rounded bg-secondary animate-pulse" />
                <div className="h-2.5 w-4 rounded bg-secondary animate-pulse" />
                <div className="size-5 rounded bg-secondary animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : rankedProjects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <FileText size={22} />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">No entries yet</p>
            <p className="mx-auto max-w-[260px] text-sm text-muted-foreground">
              {canParticipate
                ? "Share a project or idea and let the community rank it."
                : "Projects and ideas show up here once they're published."}
            </p>
          </div>
          {canParticipate && (
            <Button asChild size="sm" className="mt-1">
              <Link
                to="/projects/new/$kind"
                params={{ kind: defaultNewKind }}
                search={{
                  tab: "write",
                  kind: search.kind,
                  personal: search.personal,
                  private: search.private,
                }}
              >
                <Plus size={14} />
                New entry
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Reorder.Group
            as="div"
            axis="y"
            values={projectIds}
            onReorder={() => {}}
            className="flex flex-col gap-0"
          >
            {rankedProjects.map((project, index) => (
              <Reorder.Item
                as="div"
                key={project.id}
                value={project.id}
                layout="position"
                drag={false}
                dragListener={false}
                transition={{ layout: { type: "spring", stiffness: 300, damping: 30 } }}
              >
                <ListRow
                  rank={index + 1}
                  project={project}
                  isSelected={selectedProjectId === project.id}
                  voteDirection={userVoteMap[project.id] ?? null}
                  isUpvoting={upvoteMutation.isPending && upvoteMutation.variables === project.id}
                  isDownvoting={
                    downvoteMutation.isPending && downvoteMutation.variables === project.id
                  }
                  onMobileTap={() => handleMobileRowTap(project.id, project.kind)}
                  onDesktopSelect={() => handleDesktopRowSelect(project.id)}
                  onUpvote={() => runVote("up", project.id)}
                  onDownvote={() => runVote("down", project.id)}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <div
            ref={sentinelRef}
            className="flex justify-center py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          >
            {isFetchingNextPage && (
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
            )}
            {hasNextPage && !isFetchingNextPage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                className="text-muted-foreground font-semibold"
              >
                <ChevronDown size={14} />
                Load more
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          {filterButtons}
        </div>
        {newButton}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        {projectList}
        {!canParticipate && (
          <div className="shrink-0 border-t border-border bg-card px-4 py-2 text-sm text-center text-muted-foreground pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            Anonymous sessions can browse.{" "}
            <Link to="/settings" className="font-semibold text-brand-accent hover:underline">
              Link an identity
            </Link>{" "}
            to publish and vote.
          </div>
        )}
      </div>

      <div className="hidden min-h-0 flex-1 lg:flex overflow-hidden">
        <div className="flex flex-col overflow-hidden border-r border-border w-[380px] shrink-0">
          {projectList}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted">
          {rankedProjects.length === 0 && !isLoading ? null : !selectedProject ||
            selectedProjectQuery.isLoading ? (
            <div className="flex flex-1 flex-col gap-3 p-8">
              <div className="animate-pulse bg-border h-7 w-[200px] rounded-md" />
              <div className="animate-pulse bg-border h-4 w-4/5 rounded-md" />
              <div className="animate-pulse bg-border h-4 w-3/5 rounded-md" />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-6 py-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <KindBadge kind={selectedProject.kind} />
                    <StatusBadge status={selectedProject.status} />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <h2 className="text-xl font-semibold leading-snug text-foreground">
                      {selectedProject.title}
                    </h2>
                    {selectedProject.visibility === "private" && <PrivateIndicator />}
                  </div>
                  {selectedProject.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {selectedProject.description}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl px-2.5 py-1 bg-secondary">
                    <VoteButton
                      icon={<ChevronUp size={18} strokeWidth={2.25} />}
                      onClick={() => runVote("up", selectedProject.id)}
                      label="Upvote"
                      disabled={
                        !canParticipate ||
                        (upvoteMutation.isPending &&
                          upvoteMutation.variables === selectedProject.id)
                      }
                      active={userVoteMap[selectedProject.id] === "up"}
                      activeColor="text-brand-accent"
                    />
                    <span className="text-foreground text-sm font-bold min-w-[24px] text-center">
                      {counts[selectedProject.id] ?? 0}
                    </span>
                    <VoteButton
                      icon={<ChevronDown size={18} strokeWidth={2.25} />}
                      onClick={() => runVote("down", selectedProject.id)}
                      label="Downvote"
                      disabled={
                        !canParticipate ||
                        (downvoteMutation.isPending &&
                          downvoteMutation.variables === selectedProject.id)
                      }
                      active={userVoteMap[selectedProject.id] === "down"}
                      activeColor="text-destructive"
                    />
                  </div>

                  {selectedProject.repository && (
                    <Button asChild size="icon-sm" variant="outline">
                      <a
                        href={selectedProject.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={selectedProject.repository}
                      >
                        {isGithubUrl(selectedProject.repository) ? (
                          <GithubIcon size={14} />
                        ) : (
                          <Globe size={14} />
                        )}
                      </a>
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    onClick={() => handleShare(selectedProject.id, selectedProject.kind)}
                    title="Copy link"
                    className={copied ? "text-brand-accent" : ""}
                  >
                    {copied ? <Check size={14} /> : <Share2 size={14} />}
                  </Button>

                  <Button asChild size="sm">
                    <Link
                      to="/projects/$kind/$id"
                      params={{ kind: selectedProject.kind, id: selectedProject.id }}
                      search={{
                        kind: search.kind,
                        personal: search.personal,
                        private: search.private,
                      }}
                    >
                      Open
                      <ArrowUpRight size={13} />
                    </Link>
                  </Button>

                  {canManageSelected && (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/projects/$kind/$id/edit"
                        params={{ kind: selectedProject.kind, id: selectedProject.id }}
                        search={{
                          tab: "write",
                          kind: search.kind,
                          personal: search.personal,
                          private: search.private,
                        }}
                      >
                        <Pencil size={13} />
                        Edit
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                {selectedProject.kind === "project" && selectedReadmeQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading README…</div>
                ) : previewContent ? (
                  <Markdown content={previewContent} />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {selectedProject.kind === "project"
                      ? "No README available for this repository."
                      : "No content written yet."}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!canParticipate && (
          <div className="absolute bottom-0 left-0 right-0 shrink-0 border-t border-border bg-card px-6 py-2 text-sm text-center text-muted-foreground">
            Anonymous sessions can browse.{" "}
            <Link to="/settings" className="font-semibold text-brand-accent hover:underline">
              Link an identity
            </Link>{" "}
            to publish and vote.
          </div>
        )}
      </div>
    </div>
  );
}

function ListRow({
  rank,
  project,
  isSelected,
  voteDirection,
  isUpvoting,
  isDownvoting,
  onMobileTap,
  onDesktopSelect,
  onUpvote,
  onDownvote,
}: {
  rank: number;
  project: RankedProject;
  isSelected: boolean;
  voteDirection: VoteDirection;
  isUpvoting: boolean;
  isDownvoting: boolean;
  onMobileTap: () => void;
  onDesktopSelect: () => void;
  onUpvote: () => void;
  onDownvote: () => void;
}) {
  return (
    <div
      className={`border-b border-border flex items-center gap-2.5 px-3.5 py-3 transition-all duration-[120ms] ${isSelected ? "lg:bg-brand-accent-light lg:border-l-[3px] lg:border-l-brand-accent" : "border-l-[3px] border-l-transparent hover:bg-muted/60"}`}
    >
      <span
        className={`hidden lg:block w-6 text-xs font-bold text-center shrink-0 ${isSelected ? "text-brand-accent" : "text-muted-foreground/40"}`}
      >
        {rank}
      </span>

      <button
        type="button"
        onClick={onMobileTap}
        className="flex flex-1 min-w-0 items-center gap-3 text-left bg-transparent border-none p-0 cursor-pointer lg:hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="w-5 text-[11px] font-bold text-center text-muted-foreground/40 shrink-0">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <KindBadge kind={project.kind} compact />
            <span className="text-sm font-semibold text-foreground truncate">{project.title}</span>
            {project.visibility === "private" && <PrivateIndicator size={11} />}
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate">{project.description}</p>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onDesktopSelect}
        className="hidden lg:flex flex-1 min-w-0 items-center gap-2 cursor-pointer bg-transparent border-none p-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <KindBadge kind={project.kind} size="sidebar" />
            <span className="text-base font-semibold text-foreground truncate flex-1 min-w-0 leading-tight">
              {project.title}
            </span>
            {project.visibility === "private" && <PrivateIndicator size={11} />}
            {project.repository && (
              <a
                href={project.repository}
                target="_blank"
                rel="noopener noreferrer"
                title={project.repository}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/40 hover:text-foreground inline-flex items-center shrink-0 transition-colors duration-[120ms]"
              >
                {isGithubUrl(project.repository) ? <GithubIcon size={12} /> : <Globe size={12} />}
              </a>
            )}
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate">{project.description}</p>
          )}
        </div>
      </button>

      {/* biome-ignore lint/a11y/useSemanticElements: stopPropagation container with nested buttons */}
      <div
        className="flex flex-col items-center shrink-0 gap-0.5"
        role="button"
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <VoteButton
          icon={<ChevronUp size={14} strokeWidth={2.25} />}
          onClick={onUpvote}
          label="Upvote"
          disabled={isUpvoting}
          active={voteDirection === "up"}
          activeColor="text-brand-accent"
          size="compact"
        />
        <span className="min-w-[20px] text-center text-[11px] font-bold leading-none text-foreground">
          {project.upvoteCount}
        </span>
        <VoteButton
          icon={<ChevronDown size={14} strokeWidth={2.25} />}
          onClick={onDownvote}
          label="Downvote"
          disabled={isDownvoting}
          active={voteDirection === "down"}
          activeColor="text-destructive"
          size="compact"
        />
      </div>
    </div>
  );
}

function PrivateIndicator({ size = 12 }: { size?: number }) {
  return (
    <span
      title="Private"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary p-1 text-muted-foreground"
    >
      <Lock size={size} />
    </span>
  );
}

function KindBadge({
  kind,
  compact,
  size,
}: {
  kind: ProjectKind;
  compact?: boolean;
  size?: "default" | "sidebar";
}) {
  const isCompact = compact ?? size === "sidebar";
  const KindIcon =
    kind === "idea" ? FileText : kind === "scope" ? Layers : kind === "result" ? BarChart2 : null;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 rounded-[4px] border-border text-foreground",
        kind === "idea" || kind === "scope" || kind === "result" ? "bg-muted" : "bg-secondary",
        size === "sidebar"
          ? "gap-1 px-2 py-0.5 text-[11px] [&>svg]:size-2.5"
          : isCompact
            ? "gap-0.5 px-1.5 py-0 text-[10px] [&>svg]:size-[9px]"
            : "gap-1 px-2 py-0.5 text-[11px] [&>svg]:size-2.5",
      )}
    >
      {KindIcon ? <KindIcon /> : null}
      {kind}
    </Badge>
  );
}

function StatusBadge({ status }: { status: "active" | "paused" | "archived" }) {
  const statusClasses = {
    active: "border-brand-accent bg-brand-accent-light text-foreground",
    paused: "border-border bg-secondary text-foreground",
    archived: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <Badge
      variant="outline"
      className={cn("rounded-[4px] px-2 py-0.5 text-[11px]", statusClasses[status])}
    >
      {status}
    </Badge>
  );
}
