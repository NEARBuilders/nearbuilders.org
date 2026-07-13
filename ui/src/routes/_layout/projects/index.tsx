import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Reorder } from "framer-motion";
import {
  ArrowDownUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Lock,
  Pencil,
  Plus,
  Share2,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient, useOrpc } from "@/app";
import { NearProfile } from "@/components/near-profile";
import {
  GithubIcon,
  isGithubUrl,
  KindBadge,
  PrivateIndicator,
  type ProjectDirectoryItem,
  ProjectDirectoryListRow,
  StatusBadge,
  type VoteDirection,
} from "@/components/project-directory-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { NewBadge } from "@/components/ui/new-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VoteButton } from "@/components/ui/vote-button";
import {
  normalizeCatalogDirectoryProject,
  shouldLoadCatalogProjects,
} from "@/lib/catalog-projects";
import { fetchRepositoryReadme } from "@/lib/repository-content";
import { cn } from "@/lib/utils";
import { type ProjectKindFilter, type ProjectSort, parseProjectListSearch } from "./-search";

type RankedProject = ProjectDirectoryItem;

const PAGE_SIZE = 24;

export const Route = createFileRoute("/_layout/projects/")({
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
    if (activeKind === "all" || activeKind === "project") {
      void queryClient.prefetchInfiniteQuery({
        queryKey: ["catalog-projects", null],
        queryFn: ({ pageParam }) =>
          apiClient.listClaimedCatalogProjects({
            limit: PAGE_SIZE,
            cursor: pageParam as string | undefined,
          }),
        initialPageParam: undefined,
      });
    }
  },
  component: ProjectsList,
});

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
  const activeSort: ProjectSort = search.sort ?? "votes";

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

  const handleShare = useCallback((project: RankedProject) => {
    const url =
      project.catalogUrl ??
      (typeof window !== "undefined"
        ? `${window.location.origin}/projects/${project.kind}/${project.slug}`
        : "");
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

  const catalogEnabled = shouldLoadCatalogProjects({
    kind: activeKind,
    personal: isPersonalOnly,
    privateOnly: isPrivateOnly,
    ownerId: ownerFilterId,
  });
  const catalogQuery = useInfiniteQuery({
    queryKey: ["catalog-projects", isPersonalOnly ? (ownerFilterId ?? null) : null],
    queryFn: ({ pageParam }) =>
      apiClient.listClaimedCatalogProjects({
        nearAccount: isPersonalOnly ? ownerFilterId : undefined,
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined),
    enabled: catalogEnabled,
  });
  const localProjects = useMemo(
    () =>
      (pages?.pages.flatMap((page) => page.data) ?? []).map((project) => ({
        ...project,
        source: "local" as const,
        catalogUrl: null,
        imageUrl: null,
        contributors: [],
      })),
    [pages],
  );
  const catalogProjects = useMemo(
    () =>
      catalogQuery.data?.pages.flatMap((page) => page.data).map(normalizeCatalogDirectoryProject) ??
      [],
    [catalogQuery.data],
  );
  const projects = useMemo(
    () => [...localProjects, ...catalogProjects],
    [catalogProjects, localProjects],
  );
  const isProjectsLoading = isLoading || (catalogEnabled && catalogQuery.isLoading);
  const hasMoreProjects = hasNextPage || (catalogEnabled && catalogQuery.hasNextPage);
  const isFetchingMoreProjects =
    isFetchingNextPage || (catalogEnabled && catalogQuery.isFetchingNextPage);
  const fetchMoreProjects = useCallback(async () => {
    await Promise.all([
      hasNextPage ? fetchNextPage() : Promise.resolve(),
      catalogEnabled && catalogQuery.hasNextPage ? catalogQuery.fetchNextPage() : Promise.resolve(),
    ]);
  }, [catalogEnabled, catalogQuery, fetchNextPage, hasNextPage]);
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
    const withCounts: RankedProject[] = projects.map((p) => ({
      ...p,
      upvoteCount: counts[p.id] ?? 0,
    }));
    const byCreatedAt = (a: RankedProject, b: RankedProject) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    switch (activeSort) {
      case "newest":
        return withCounts.sort((a, b) => byCreatedAt(b, a));
      case "oldest":
        return withCounts.sort(byCreatedAt);
      default:
        return withCounts.sort((a, b) => b.upvoteCount - a.upvoteCount);
    }
  }, [projects, counts, activeSort]);
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
  const selectedSummary = rankedProjects.find((project) => project.id === selectedProjectId);

  const selectedProjectQuery = useQuery({
    queryKey: ["project", selectedProjectId],
    queryFn: () => apiClient.getProject({ id: selectedProjectId! }),
    enabled: Boolean(selectedProjectId) && selectedSummary?.source === "local",
  });

  const selectedProject: RankedProject | undefined =
    selectedSummary?.source === "nearcatalog"
      ? selectedSummary
      : selectedProjectQuery.data?.data
        ? {
            ...selectedProjectQuery.data.data,
            upvoteCount: counts[selectedProjectQuery.data.data.id] ?? 0,
            source: "local",
            catalogUrl: null,
            imageUrl: null,
            contributors: [],
          }
        : selectedSummary;

  const isAdminUser = user?.role === "admin";
  const canManageSelected =
    selectedProject?.source === "local" &&
    (isAdminUser || isCurrentUserOwner(selectedProject.ownerId, user, nearAccountId));

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
      if (!node || !hasMoreProjects || isFetchingMoreProjects) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) void fetchMoreProjects();
      });
      observerRef.current.observe(node);
    },
    [fetchMoreProjects, hasMoreProjects, isFetchingMoreProjects],
  );

  const handleMobileRowTap = (project: RankedProject) => {
    if (project.catalogUrl) {
      window.open(project.catalogUrl, "_blank", "noopener,noreferrer");
      return;
    }
    void navigate({
      to: "/projects/$kind/$slug",
      params: { kind: project.kind, slug: project.slug },
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
        sort: search.sort,
      }),
    });
  };

  const handleSortChange = (sort: ProjectSort) => {
    void navigate({
      to: "/projects",
      search: (prev) => ({ ...prev, sort: sort === "votes" ? undefined : sort }),
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
        sort: search.sort,
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
        sort: search.sort,
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
                ? "bg-card dark:bg-accent text-foreground shadow-sm"
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

      <Select value={activeSort} onValueChange={(v) => handleSortChange(v as ProjectSort)}>
        <SelectTrigger
          size="sm"
          className="h-8 w-auto gap-1.5 rounded-lg bg-secondary font-semibold"
          aria-label="Sort projects"
        >
          <ArrowDownUp size={13} className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="votes">Most votes</SelectItem>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
        </SelectContent>
      </Select>
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
      {isProjectsLoading ? (
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-3.5 py-3">
              <div className="hidden lg:block size-4 shrink-0 rounded bg-secondary animate-pulse" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-1/2 rounded bg-secondary animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-secondary animate-pulse" />
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-1 py-0.5">
                <div className="size-7 rounded-md bg-muted animate-pulse" />
                <div className="h-2.5 w-4 rounded bg-muted animate-pulse" />
                <div className="size-7 rounded-md bg-muted animate-pulse" />
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
                <ProjectDirectoryListRow
                  rank={index + 1}
                  project={project}
                  isSelected={selectedProjectId === project.id}
                  voteDirection={userVoteMap[project.id] ?? null}
                  isUpvoting={upvoteMutation.isPending && upvoteMutation.variables === project.id}
                  isDownvoting={
                    downvoteMutation.isPending && downvoteMutation.variables === project.id
                  }
                  onMobileTap={() => handleMobileRowTap(project)}
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
            {isFetchingMoreProjects && (
              <div className="size-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
            )}
            {hasMoreProjects && !isFetchingMoreProjects && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void fetchMoreProjects()}
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
    <TooltipProvider>
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
            {rankedProjects.length === 0 && !isProjectsLoading ? null : !selectedProject ||
              (selectedSummary?.source === "local" && selectedProjectQuery.isLoading) ? (
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
                      {selectedProject.source === "nearcatalog" && (
                        <Badge variant="outline">NearCatalog</Badge>
                      )}
                      <StatusBadge status={selectedProject.status} />
                      <NewBadge createdAt={selectedProject.createdAt} />
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <VoteButton
                            icon={<ThumbsUp size={18} strokeWidth={2.25} />}
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
                        </TooltipTrigger>
                        <TooltipContent>Endorse this entry</TooltipContent>
                      </Tooltip>
                      <span className="text-foreground text-sm font-bold min-w-[24px] text-center">
                        {counts[selectedProject.id] ?? 0}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <VoteButton
                            icon={<ThumbsDown size={18} strokeWidth={2.25} />}
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
                        </TooltipTrigger>
                        <TooltipContent>Remove your endorsement</TooltipContent>
                      </Tooltip>
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
                      onClick={() => handleShare(selectedProject)}
                      title="Copy link"
                      className={copied ? "text-brand-accent" : ""}
                    >
                      {copied ? <Check size={14} /> : <Share2 size={14} />}
                    </Button>

                    <Button asChild size="sm">
                      {selectedProject.catalogUrl ? (
                        <a
                          href={selectedProject.catalogUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open Catalog
                          <ArrowUpRight size={13} />
                        </a>
                      ) : (
                        <Link
                          to="/projects/$kind/$slug"
                          params={{ kind: selectedProject.kind, slug: selectedProject.slug }}
                          search={{
                            kind: search.kind,
                            personal: search.personal,
                            private: search.private,
                          }}
                        >
                          Open
                          <ArrowUpRight size={13} />
                        </Link>
                      )}
                    </Button>

                    {canManageSelected && (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/projects/$kind/$slug/edit"
                          params={{ kind: selectedProject.kind, slug: selectedProject.slug }}
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
                  {selectedProject.source === "nearcatalog" &&
                    selectedProject.contributors.length > 0 && (
                      <section className="mb-6 rounded-xl border border-border bg-card p-4">
                        <h3 className="font-semibold text-foreground">Verified contributors</h3>
                        <div className="mt-3 space-y-3">
                          {selectedProject.contributors.map((contributor) => (
                            <div
                              key={contributor.nearAccount}
                              className="rounded-lg border border-border p-3"
                            >
                              <Link
                                to="/builders/$account"
                                params={{ account: contributor.nearAccount }}
                                className="inline-flex rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                aria-label={`View ${contributor.nearAccount}'s builder profile`}
                              >
                                <NearProfile
                                  accountId={contributor.nearAccount}
                                  variant="badge"
                                  className="w-auto"
                                />
                              </Link>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {contributor.roles.map((role) => (
                                  <Badge key={role} variant="secondary">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
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
    </TooltipProvider>
  );
}
