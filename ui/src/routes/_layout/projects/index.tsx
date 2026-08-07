import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Globe,
  Layers3,
  Link2,
  Lock,
  Plus,
  Search,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient, useOrpc } from "@/app";
import {
  GithubIcon,
  isGithubUrl,
  KindBadge,
  PrivateIndicator,
  type ProjectDirectoryItem,
  StatusBadge,
  type VoteDirection,
} from "@/components/project-directory-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { NewBadge } from "@/components/ui/new-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VoteButton } from "@/components/ui/vote-button";
import {
  normalizeCatalogDirectoryProjectData,
  selectCatalogDirectoryProjects,
  shouldLoadCatalogProjects,
} from "@/lib/catalog-projects";
import { fetchRepositoryReadme } from "@/lib/repository-content";
import { cn } from "@/lib/utils";
import {
  type ProjectKindFilter,
  type ProjectSort,
  type ProjectStatusFilter,
  parseProjectListSearch,
} from "./-search";

type RankedProject = ProjectDirectoryItem;

type ProjectDetailData = {
  apps: Array<{
    accountId: string;
    domain: string;
    createdAt: string;
  }>;
};

const PAGE_SIZE = 24;

export const Route = createFileRoute("/_layout/projects/")({
  validateSearch: parseProjectListSearch,
  head: () => ({
    meta: [
      { title: "Projects | NearBuilders" },
      {
        name: "description",
        content: "Find projects, ideas, scopes, and results from the NEAR builder network.",
      },
    ],
  }),
  loaderDeps: ({ search }) => ({
    kind: search.kind,
    personal: search.personal,
    private: search.private,
    verified: search.verified,
    query: search.query,
    status: search.status,
    sort: search.sort,
  }),
  loader: ({ context, deps }) => {
    const { queryClient, apiClient } = context;
    const activeKind = isProjectKindFilter(deps.kind) ? deps.kind : "all";
    const privateOnly = deps.personal && !deps.verified && deps.private;
    const serverSort = deps.sort === "oldest" ? "oldest" : "newest";

    if (!deps.personal && !deps.verified) {
      void queryClient.prefetchInfiniteQuery({
        queryKey: [
          "projects",
          activeKind,
          null,
          Boolean(privateOnly),
          deps.query ?? null,
          deps.status ?? null,
          serverSort,
        ],
        queryFn: ({ pageParam }) =>
          apiClient.listProjects({
            limit: PAGE_SIZE,
            cursor: pageParam as string | undefined,
            kind: activeKind === "all" ? undefined : activeKind,
            query: deps.query,
            status: deps.status === "all" ? undefined : deps.status,
            sort: serverSort,
          }),
        initialPageParam: undefined,
      });
    }

    if (
      shouldLoadCatalogProjects({
        kind: activeKind,
        personal: Boolean(deps.personal),
        privateOnly: Boolean(privateOnly),
      })
    ) {
      void queryClient.prefetchInfiniteQuery({
        queryKey: ["catalog-projects", null, deps.query ?? null],
        queryFn: ({ pageParam }) =>
          apiClient.listClaimedCatalogProjects({
            query: deps.query,
            limit: PAGE_SIZE,
            cursor: pageParam as string | undefined,
          }),
        initialPageParam: undefined,
      });
    }
  },
  component: ProjectsList,
});

function isProjectKindFilter(value: unknown): value is ProjectKindFilter {
  return (
    value === "all" ||
    value === "project" ||
    value === "idea" ||
    value === "scope" ||
    value === "result"
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

function formatOwner(ownerId: string | null | undefined) {
  if (!ownerId) return "Community entry";
  if (ownerId.length <= 24) return ownerId;
  return `${ownerId.slice(0, 10)}…${ownerId.slice(-7)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function matchesCatalogQuery(project: Omit<ProjectDirectoryItem, "upvoteCount">, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [
    project.title,
    project.slug,
    project.description,
    project.content,
    project.repository,
    project.domain,
    project.catalogPhase,
    project.catalogStatus,
    ...project.catalogTags,
    ...project.contributors.map((contributor) => contributor.nearAccount),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function ProjectVisual({
  project,
  className,
}: {
  project: ProjectDirectoryItem;
  className?: string;
}) {
  const initials = project.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return project.imageUrl ? (
    <img
      src={project.imageUrl}
      alt=""
      className={cn("size-14 shrink-0 rounded-2xl border border-border object-cover", className)}
      loading="lazy"
    />
  ) : (
    <span
      className={cn(
        "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-accent-light text-lg font-black tracking-tight text-brand-accent",
        className,
      )}
      aria-hidden="true"
    >
      {initials || "NB"}
    </span>
  );
}

function FilterChip({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 sm:w-auto",
        active
          ? "border-brand-accent-border bg-brand-accent-light text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ProjectTags({ project }: { project: RankedProject }) {
  return (
    <span className="flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap">
      <span className="shrink-0">
        <KindBadge kind={project.kind} className="rounded-full border" />
      </span>
      <span className="shrink-0">
        <StatusBadge
          status={project.status}
          className={cn(
            "rounded-full border",
            project.status === "active" && "border-brand-accent-border",
          )}
        />
      </span>
      {project.source === "nearcatalog" && (
        <span className="shrink-0">
          <Badge variant="outline" className="rounded-full border px-2 py-0.5 text-[11px]">
            Catalog
          </Badge>
        </span>
      )}
      <span className="shrink-0">
        <NewBadge createdAt={project.createdAt} className="rounded-full border" />
      </span>
      {project.visibility === "private" && (
        <span className="shrink-0">
          <PrivateIndicator size={10} />
        </span>
      )}
    </span>
  );
}

function ProjectCard({
  project,
  isSelected,
  voteCountAvailable,
  onOpen,
}: {
  project: RankedProject;
  isSelected: boolean;
  voteCountAvailable: boolean;
  onOpen: () => void;
}) {
  const endorsementLabel = voteCountAvailable
    ? `${project.upvoteCount} endorsements`
    : "endorsement count unavailable";
  return (
    <div
      className={cn(
        "group w-full border-b border-border/70 border-l-2 border-l-transparent text-left transition-colors last:border-b-0",
        isSelected ? "border-l-brand-accent bg-brand-accent-light" : "hover:bg-secondary",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Preview ${project.title}. ${project.kind}, ${project.status}. ${endorsementLabel}.`}
        className="grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-x-4 sm:px-5"
      >
        <ProjectVisual project={project} className="self-center size-10 rounded-xl" />
        <span className="min-w-0 flex-1">
          <ProjectTags project={project} />
          <span className="mt-1 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-bold text-foreground">{project.title}</span>
          </span>
          <span className="mt-1 line-clamp-1 text-sm leading-relaxed text-muted-foreground">
            {project.description || "No description added yet."}
          </span>
        </span>
        <span className="flex shrink-0 self-center items-center justify-self-end gap-2 sm:w-20 sm:justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold tabular-nums text-foreground">
            <ThumbsUp className="size-3.5 text-brand-accent" />
            {voteCountAvailable ? project.upvoteCount : "—"}
          </span>
          <ArrowRight className="size-4 text-muted-foreground opacity-60 transition-all group-hover:translate-x-0.5 group-hover:text-brand-accent group-hover:opacity-100" />
        </span>
      </button>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
      <div className="size-10 animate-pulse rounded-xl bg-secondary" />
      <div className="min-w-0 space-y-2">
        <div className="h-3 w-44 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-secondary" />
      </div>
      <div className="h-7 w-16 animate-pulse rounded-full bg-secondary" />
    </div>
  );
}

function ProjectErrorState({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-bold text-foreground">Unable to load entries</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Something went wrong while loading the directory. Try again in a moment.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-4"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}

function ProjectPaginationError({
  onRetry,
  isRetrying,
  ranking,
}: {
  onRetry: () => void;
  isRetrying: boolean;
  ranking: boolean;
}) {
  return (
    <div className="border-t border-border bg-secondary/60 px-5 py-4 text-center">
      <p className="text-xs text-muted-foreground">
        {ranking
          ? "Some entries could not be loaded, so this ranking is based on the entries currently available."
          : "Some entries could not be loaded."}
      </p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-2"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? "Retrying…" : "Retry loading"}
      </Button>
    </div>
  );
}

function ProjectCount({ total, loaded }: { total: number; loaded: number }) {
  const hasUnloadedEntries = total > loaded;
  return (
    <span
      role="status"
      className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground"
      aria-label={`${total} entries${hasUnloadedEntries ? `, ${loaded} loaded` : ""}`}
    >
      {hasUnloadedEntries ? `${total} total` : total}
    </span>
  );
}

function ProjectListLabel({ kind }: { kind: ProjectKindFilter }) {
  if (kind === "all") return "All entries";
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} entries`;
}

function VoteDataNotice() {
  return (
    <p className="border-b border-border bg-secondary/60 px-4 py-2 text-xs text-muted-foreground sm:px-5">
      Endorsement counts are temporarily unavailable. The directory is still browseable.
    </p>
  );
}

function IdentityHint() {
  return <p className="text-xs text-muted-foreground">Link an identity to endorse entries.</p>;
}

function ProjectBriefNotice({ readmeUnavailable }: { readmeUnavailable: boolean }) {
  if (!readmeUnavailable) return null;
  return (
    <p className="text-xs text-muted-foreground">
      README unavailable. Showing the project description instead.
    </p>
  );
}

function getProjectContentLabel(project: RankedProject, hasReadme: boolean) {
  if (project.kind !== "project") return "Project brief";
  return hasReadme ? "README" : "Project brief";
}

function getCatalogEmptyMessage(status: ProjectStatusFilter) {
  if (status === "paused" || status === "archived") {
    return "Catalog-verified entries are currently active only.";
  }
  return "Verified Catalog projects will appear here once claimed.";
}

function getProjectLoadingMessage(sort: ProjectSort) {
  return sort === "votes" ? "Loading all entries to rank them…" : "Loading entries…";
}

function ProjectLoadingState({ sort }: { sort: ProjectSort }) {
  return (
    <div>
      <p className="sr-only" role="status">
        {getProjectLoadingMessage(sort)}
      </p>
      {Array.from({ length: 6 }).map((_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
  );
}

function ProjectPreviewHeader({ title }: { title: string }) {
  return (
    <SheetHeader className="flex-row items-center justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">
          Entry details
        </p>
        <SheetTitle className="mt-1 truncate text-sm font-bold">Entry preview</SheetTitle>
        <SheetDescription className="sr-only">
          Preview {title}, including its description, endorsements, and connected resources.
        </SheetDescription>
      </div>
    </SheetHeader>
  );
}

function ProjectDetailPanel({
  project,
  detail,
  readme,
  isReadmeLoading,
  isReadmeError,
  voteCountAvailable,
  voteDirection,
  canParticipate,
  canManage,
  isUpvoting,
  isDownvoting,
  copied,
  search,
  onVote,
  onShare,
}: {
  project: RankedProject;
  detail?: ProjectDetailData;
  readme?: string | null;
  isReadmeLoading: boolean;
  isReadmeError: boolean;
  voteCountAvailable: boolean;
  voteDirection: VoteDirection;
  canParticipate: boolean;
  canManage: boolean;
  isUpvoting: boolean;
  isDownvoting: boolean;
  copied: boolean;
  search: ReturnType<typeof parseProjectListSearch>;
  onVote: (direction: "up" | "down") => void;
  onShare: () => void;
}) {
  const hasReadme = project.kind === "project" && Boolean(readme);
  const readmeUnavailable =
    project.kind === "project" && !isReadmeLoading && isReadmeError && !readme;
  const content = project.kind === "project" ? readme || project.description : project.content;
  const detailSearch = { ...search, preview: undefined };

  return (
    <div className="min-w-0">
      <div className="bg-card px-5 py-6 sm:px-7 lg:px-9 lg:py-8">
        <div className="flex items-start gap-3">
          <ProjectVisual project={project} className="size-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <KindBadge kind={project.kind} />
              {project.source === "nearcatalog" && (
                <Badge variant="outline" className="border-brand-accent-border text-brand-accent">
                  Near Catalog
                </Badge>
              )}
              <StatusBadge status={project.status} />
              <NewBadge createdAt={project.createdAt} />
              {project.visibility === "private" && <PrivateIndicator />}
            </div>
            <h2 className="mt-3 break-words text-xl font-bold leading-tight text-foreground">
              {project.title}
            </h2>
            {project.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-secondary p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <VoteButton
                  icon={<ThumbsUp size={17} strokeWidth={2.25} />}
                  onClick={() => onVote("up")}
                  label="Endorse this entry"
                  disabled={!canParticipate || isUpvoting}
                  active={voteDirection === "up"}
                  activeColor="text-brand-accent"
                />
              </TooltipTrigger>
              <TooltipContent>Endorse this entry</TooltipContent>
            </Tooltip>
            <span className="min-w-7 text-center text-sm font-bold tabular-nums text-foreground">
              {voteCountAvailable ? project.upvoteCount : "—"}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <VoteButton
                  icon={<ThumbsDown size={17} strokeWidth={2.25} />}
                  onClick={() => onVote("down")}
                  label="Remove your endorsement"
                  disabled={!canParticipate || isDownvoting}
                  active={voteDirection === "down"}
                  activeColor="text-destructive"
                />
              </TooltipTrigger>
              <TooltipContent>Remove your endorsement</TooltipContent>
            </Tooltip>
          </div>

          {project.repository && (
            <Button asChild size="icon-sm" variant="outline" aria-label="Open repository">
              <a href={project.repository} target="_blank" rel="noopener noreferrer">
                {isGithubUrl(project.repository) ? <GithubIcon size={14} /> : <Globe size={14} />}
              </a>
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onShare}
            aria-label="Copy link"
          >
            {copied ? <Check size={14} className="text-brand-accent" /> : <Share2 size={14} />}
          </Button>
          {project.catalogUrl ? (
            <Button asChild size="sm">
              <a href={project.catalogUrl} target="_blank" rel="noopener noreferrer">
                Open Catalog
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link
                to="/projects/$kind/$slug"
                params={{ kind: project.kind, slug: project.slug }}
                search={detailSearch}
                replace
              >
                Open details
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          )}
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link
                to="/projects/$kind/$slug/edit"
                params={{ kind: project.kind, slug: project.slug }}
                search={{ ...detailSearch, tab: "write" }}
              >
                Edit
              </Link>
            </Button>
          )}
        </div>
        {!canParticipate && <IdentityHint />}
      </div>

      <div className="bg-card px-5 sm:px-7 lg:px-9">
        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border py-4 text-xs font-semibold text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound className="size-3.5 shrink-0 text-brand-accent" />
            <span>Owner</span>
            {project.ownerId ? (
              <Link
                to="/builders/$account"
                params={{ account: project.ownerId }}
                className="truncate text-brand-cyan hover:underline"
              >
                {formatOwner(project.ownerId)}
              </Link>
            ) : (
              <span>Verified network entry</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 capitalize">
            <Eye className="size-3.5 text-brand-accent" />
            {project.visibility}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-brand-accent" />
            Updated {formatDate(project.updatedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ThumbsUp className="size-3.5 text-brand-accent" />
            {voteCountAvailable
              ? `${project.upvoteCount} endorsements`
              : "Endorsement count unavailable"}
          </span>
        </section>
      </div>

      <div className="bg-muted/20 px-5 py-5 sm:px-7 lg:px-9">
        <div className="space-y-5">
          {project.source === "nearcatalog" && project.contributors.length > 0 && (
            <section className="rounded-2xl border border-brand-accent-border bg-brand-accent-light p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand-accent" />
                <h3 className="text-sm font-bold text-foreground">Verified contributors</h3>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.contributors.map((contributor) => (
                  <Link
                    key={contributor.nearAccount}
                    to="/builders/$account"
                    params={{ account: contributor.nearAccount }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="size-5 rounded-full bg-secondary text-center text-[10px] leading-5 text-muted-foreground">
                      {contributor.nearAccount.charAt(0).toUpperCase()}
                    </span>
                    <span className="max-w-[145px] truncate">{contributor.nearAccount}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-brand-accent" />
                <h3 className="text-sm font-bold text-foreground">
                  {getProjectContentLabel(project, hasReadme)}
                </h3>
              </div>
              {project.catalogPhase && <Badge variant="secondary">{project.catalogPhase}</Badge>}
            </div>
            <div className="pt-4">
              <ProjectBriefNotice readmeUnavailable={readmeUnavailable} />
              {isReadmeLoading ? (
                <div className="space-y-3">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-secondary" />
                  <div className="h-4 w-full animate-pulse rounded bg-secondary" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-secondary" />
                </div>
              ) : content ? (
                <Markdown
                  content={content}
                  className="[&_p]:text-sm [&_p]:leading-6 [&_h1]:text-2xl [&_h2]:text-xl"
                />
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This entry does not have a longer brief yet. Open the details page to see the full
                  project record.
                </p>
              )}
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="size-3.5 text-brand-accent" />
              <span className="font-mono">{project.slug}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-brand-accent" />
              Created {formatDate(project.createdAt)}
            </span>
            {project.domain && (
              <a
                href={`https://${project.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-cyan hover:underline"
              >
                <Globe className="size-3.5" />
                {project.domain}
              </a>
            )}
            {project.catalogStatus && <span>Catalog: {project.catalogStatus}</span>}
            {project.organizationId && <span>Org: {project.organizationId}</span>}
          </section>

          {detail && detail.apps.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Layers3 className="size-4 text-brand-accent" />
                <h3 className="text-sm font-bold text-foreground">Connected apps</h3>
              </div>
              <div className="mt-3 space-y-2">
                {detail.apps.map((app) => (
                  <div
                    key={`${app.accountId}:${app.domain}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-xs"
                  >
                    <span className="truncate font-mono text-foreground">{app.domain}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatOwner(app.accountId)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectsList() {
  const apiClient = useApiClient();
  const orpc = useOrpc();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const search = Route.useSearch();
  const activeKind = isProjectKindFilter(search.kind) ? search.kind : "all";
  const requestedPersonalOnly = search.personal === true;
  const isVerifiedOnly = search.verified === true;
  const activeSort: ProjectSort = search.sort ?? "votes";
  const activeStatus: ProjectStatusFilter = search.status ?? "all";
  const [queryInput, setQueryInput] = useState(search.query ?? "");
  const [copied, setCopied] = useState(false);

  const sessionQuery = useQuery(sessionQueryOptions(auth, undefined));
  const { data: session } = sessionQuery;
  const user = session?.user;
  const userId = user?.id;
  const nearAccountId = auth.near.getAccountId();
  const ownerFilterId = user?.isAnonymous
    ? undefined
    : (nearAccountId ??
      (user as { walletAddress?: string | null } | undefined)?.walletAddress ??
      user?.id);
  const canParticipate = Boolean(user && !user.isAnonymous);
  const isPersonalOnly = requestedPersonalOnly && Boolean(ownerFilterId);
  const isPrivateOnly = isPersonalOnly && !isVerifiedOnly && search.private === true;
  const serverSort = activeSort === "oldest" ? "oldest" : "newest";
  const listQueryKey = useMemo(
    () =>
      [
        "projects",
        activeKind,
        isPersonalOnly ? (ownerFilterId ?? null) : null,
        isPrivateOnly,
        search.query ?? null,
        search.status ?? null,
        serverSort,
      ] as const,
    [
      activeKind,
      isPersonalOnly,
      isPrivateOnly,
      ownerFilterId,
      search.query,
      search.status,
      serverSort,
    ],
  );

  const {
    data: pages,
    isLoading,
    isError,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    refetch: refetchProjects,
  } = useInfiniteQuery({
    queryKey: listQueryKey,
    queryFn: ({ pageParam }) =>
      apiClient.listProjects({
        limit: PAGE_SIZE,
        cursor: pageParam,
        kind: activeKind === "all" ? undefined : activeKind,
        ownerId: isPersonalOnly ? ownerFilterId : undefined,
        visibility: isPrivateOnly ? "private" : undefined,
        query: search.query,
        status: search.status === "all" ? undefined : search.status,
        sort: serverSort,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined),
    enabled: !isVerifiedOnly && (!isPersonalOnly || Boolean(ownerFilterId)),
  });

  const catalogEnabled = shouldLoadCatalogProjects({
    kind: activeKind,
    personal: isPersonalOnly,
    privateOnly: isPrivateOnly,
    ownerId: ownerFilterId,
  });
  const catalogQuery = useInfiniteQuery({
    queryKey: [
      "catalog-projects",
      isPersonalOnly ? (ownerFilterId ?? null) : null,
      search.query ?? null,
    ],
    queryFn: ({ pageParam }) =>
      apiClient.listClaimedCatalogProjects({
        nearAccount: isPersonalOnly ? ownerFilterId : undefined,
        query: search.query,
        limit: PAGE_SIZE,
        cursor: pageParam,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasMore ? lastPage.meta.nextCursor : undefined),
    enabled: catalogEnabled,
  });
  const {
    data: catalogPages,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    isFetching: isCatalogFetching,
    fetchNextPage: fetchNextCatalogPage,
    hasNextPage: hasNextCatalogPage,
    isFetchingNextPage: isFetchingNextCatalogPage,
    isFetchNextPageError: isFetchNextCatalogPageError,
    refetch: refetchCatalogProjects,
  } = catalogQuery;

  const localProjects = useMemo(() => {
    if (isVerifiedOnly) return [];
    const normalized = (pages?.pages.flatMap((page) => page.data) ?? []).map((project) => ({
      ...project,
      source: "local" as const,
      catalogUrl: null,
      imageUrl: null,
      catalogTags: [],
      catalogPhase: null,
      catalogStatus: null,
      contributors: [],
    }));
    return normalized.filter((project) => matchesCatalogQuery(project, search.query ?? ""));
  }, [isVerifiedOnly, pages, search.query]);
  const catalogProjects = useMemo(() => {
    const normalized = selectCatalogDirectoryProjects(
      catalogPages?.pages.flatMap((page) => page.data) ?? [],
      catalogEnabled,
    );
    if (activeStatus !== "all" && activeStatus !== "active") return [];
    return normalized.filter((project) => matchesCatalogQuery(project, search.query ?? ""));
  }, [activeStatus, catalogEnabled, catalogPages, search.query]);
  const projects = useMemo(
    () => [...localProjects, ...catalogProjects],
    [catalogProjects, localProjects],
  );
  const localProjectTotal = isVerifiedOnly ? 0 : (pages?.pages[0]?.meta.total ?? 0);
  const catalogProjectTotal =
    catalogEnabled && (activeStatus === "all" || activeStatus === "active")
      ? (catalogPages?.pages[0]?.meta.total ?? 0)
      : 0;
  const totalProjectCount = localProjectTotal + catalogProjectTotal;
  const isProjectsLoading = (!isVerifiedOnly && isLoading) || (catalogEnabled && isCatalogLoading);
  const isProjectsError = (!isVerifiedOnly && isError) || (catalogEnabled && isCatalogError);
  const isProjectsPaginationError =
    (!isVerifiedOnly && isFetchNextPageError) || (catalogEnabled && isFetchNextCatalogPageError);
  const hasMoreProjects =
    (!isVerifiedOnly && hasNextPage) || (catalogEnabled && hasNextCatalogPage);
  const isFetchingMoreProjects =
    (!isVerifiedOnly && isFetchingNextPage) || (catalogEnabled && isFetchingNextCatalogPage);
  const fetchMoreProjects = useCallback(async () => {
    await Promise.all([
      !isVerifiedOnly && hasNextPage ? fetchNextPage() : Promise.resolve(),
      catalogEnabled && hasNextCatalogPage ? fetchNextCatalogPage() : Promise.resolve(),
    ]);
  }, [
    catalogEnabled,
    fetchNextCatalogPage,
    fetchNextPage,
    hasNextCatalogPage,
    hasNextPage,
    isVerifiedOnly,
  ]);
  const retryProjects = useCallback(async () => {
    await Promise.all([
      !isVerifiedOnly ? refetchProjects() : Promise.resolve(),
      catalogEnabled ? refetchCatalogProjects() : Promise.resolve(),
    ]);
  }, [catalogEnabled, refetchCatalogProjects, refetchProjects, isVerifiedOnly]);

  useEffect(() => {
    if (
      activeSort !== "votes" ||
      isProjectsLoading ||
      isProjectsError ||
      isProjectsPaginationError ||
      isFetchingMoreProjects ||
      !hasMoreProjects
    ) {
      return;
    }
    void fetchMoreProjects();
  }, [
    activeSort,
    fetchMoreProjects,
    hasMoreProjects,
    isFetchingMoreProjects,
    isProjectsError,
    isProjectsLoading,
    isProjectsPaginationError,
  ]);
  const isRankingLoading =
    activeSort === "votes" &&
    !isProjectsPaginationError &&
    (isProjectsLoading || isFetchingMoreProjects || Boolean(hasMoreProjects));

  const projectIdList = useMemo(() => projects.map((project) => project.id), [projects]);
  const upvoteCounts = useQuery({
    queryKey: ["upvoteCounts", projectIdList],
    queryFn: async () => {
      const chunks = Array.from({ length: Math.ceil(projectIdList.length / 100) }, (_, index) =>
        projectIdList.slice(index * 100, (index + 1) * 100),
      );
      const results = await Promise.all(
        chunks.map((entityIds) => apiClient.getUpvoteCounts({ entityIds })),
      );
      const countResults: Record<string, { totalCount: number }> = Object.assign({}, ...results);
      return Object.fromEntries(
        Object.entries(countResults).map(([entityId, result]) => [entityId, result.totalCount]),
      );
    },
    enabled: projects.length > 0,
  });
  const counts = upvoteCounts.data ?? {};
  const voteCountAvailable = !upvoteCounts.isLoading && !upvoteCounts.isError;
  const rankedProjects = useMemo<RankedProject[]>(() => {
    const withCounts = projects.map((project) => ({
      ...project,
      upvoteCount: counts[project.id] ?? 0,
    }));
    const byCreatedAt = (a: RankedProject, b: RankedProject) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (activeSort === "newest") return withCounts.sort((a, b) => byCreatedAt(b, a));
    if (activeSort === "oldest") return withCounts.sort(byCreatedAt);
    return withCounts.sort((a, b) => {
      const voteDifference = b.upvoteCount - a.upvoteCount;
      return voteDifference || byCreatedAt(b, a);
    });
  }, [activeSort, counts, projects]);

  const userVoteStates = useQuery({
    queryKey: ["userVoteStates", projectIdList],
    queryFn: async () => {
      const chunks = Array.from({ length: Math.ceil(projectIdList.length / 100) }, (_, index) =>
        projectIdList.slice(index * 100, (index + 1) * 100),
      );
      const results = await Promise.all(
        chunks.map((entityIds) => apiClient.getUserVotes({ entityIds })),
      );
      return Object.assign(
        {},
        ...results.map((result) =>
          Object.fromEntries(
            Object.entries(result).map(([entityId, vote]) => [
              entityId,
              vote.hasUpvote ? "up" : null,
            ]),
          ),
        ),
      ) as Record<string, VoteDirection>;
    },
    enabled: canParticipate && projects.length > 0,
  });
  const userVoteMap = userVoteStates.data ?? {};

  const { data: latestVote } = useQuery(
    orpc.subscribeUpvotes.experimental_liveOptions({ retry: true }),
  );

  useEffect(() => {
    if (!latestVote) return;
    const { entityId, totalCount, type } = latestVote;
    queryClient.setQueryData(
      ["upvoteCounts", projectIdList],
      (old: Record<string, number> | undefined) => ({ ...old, [entityId]: totalCount }),
    );
    if (userId && latestVote.userId === userId) {
      queryClient.setQueryData(
        ["userVoteStates", projectIdList],
        (old: Record<string, VoteDirection> | undefined) => ({
          ...old,
          [entityId]: type === "downvote" ? "down" : "up",
        }),
      );
    }
  }, [latestVote, projectIdList, queryClient, userId]);

  const selectedPreviewId = search.preview;
  const selectedSummary = rankedProjects.find((project) => project.id === selectedPreviewId);
  const selectedProjectQuery = useQuery({
    queryKey: ["project", selectedPreviewId],
    queryFn: () => apiClient.getProject({ id: selectedPreviewId! }),
    enabled:
      Boolean(selectedPreviewId) &&
      !selectedPreviewId?.startsWith("nearcatalog:") &&
      selectedSummary?.source !== "nearcatalog",
  });
  const selectedCatalogSlug = selectedPreviewId?.startsWith("nearcatalog:")
    ? selectedPreviewId.slice("nearcatalog:".length)
    : undefined;
  const selectedCatalogQuery = useQuery({
    queryKey: ["catalog-project", selectedCatalogSlug],
    queryFn: () => apiClient.getCatalogProject({ slug: selectedCatalogSlug! }),
    enabled: Boolean(selectedCatalogSlug) && selectedSummary?.source !== "nearcatalog",
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
            catalogTags: [],
            catalogPhase: null,
            catalogStatus: null,
            contributors: [],
          }
        : selectedCatalogQuery.data?.data
          ? {
              ...normalizeCatalogDirectoryProjectData(selectedCatalogQuery.data.data),
              upvoteCount: counts[selectedCatalogQuery.data.data.projectRef] ?? 0,
            }
          : selectedSummary;
  const selectedPreviewLookupFailed =
    Boolean(selectedPreviewId) &&
    ((selectedProjectQuery.isError && !selectedPreviewId?.startsWith("nearcatalog:")) ||
      (selectedCatalogQuery.isError && Boolean(selectedCatalogSlug)));
  const canManageSelected =
    selectedProject?.source === "local" &&
    isCurrentUserOwner(selectedProject.ownerId, user, nearAccountId);
  const selectedReadmeQuery = useQuery({
    queryKey: ["projectPreviewReadme", selectedProject?.id, selectedProject?.repository],
    queryFn: async () =>
      selectedProject?.repository ? fetchRepositoryReadme(selectedProject.repository) : null,
    enabled:
      selectedProject?.source === "local" &&
      selectedProject.kind === "project" &&
      Boolean(selectedProject.repository),
  });

  const upvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.upvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["upvoteCounts", projectIdList],
        (old: Record<string, number> | undefined) => ({ ...old, [data.entityId]: data.totalCount }),
      );
      queryClient.setQueryData(
        ["userVoteStates", projectIdList],
        (old: Record<string, VoteDirection> | undefined) => ({ ...old, [data.entityId]: "up" }),
      );
    },
    onError: (error: Error) => toast.error(error.message || "Failed to endorse entry"),
  });
  const downvoteMutation = useMutation({
    mutationFn: (entityId: string) => apiClient.downvote({ entityId }),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["upvoteCounts", projectIdList],
        (old: Record<string, number> | undefined) => ({ ...old, [data.entityId]: data.totalCount }),
      );
      queryClient.setQueryData(
        ["userVoteStates", projectIdList],
        (old: Record<string, VoteDirection> | undefined) => ({ ...old, [data.entityId]: "down" }),
      );
    },
    onError: (error: Error) => toast.error(error.message || "Failed to remove endorsement"),
  });

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (!node || !hasMoreProjects || isFetchingMoreProjects) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) void fetchMoreProjects();
        },
        { rootMargin: "320px 0px" },
      );
      observerRef.current.observe(node);
    },
    [fetchMoreProjects, hasMoreProjects, isFetchingMoreProjects],
  );

  useEffect(() => {
    setQueryInput(search.query ?? "");
  }, [search.query]);

  useEffect(() => {
    if (sessionQuery.isLoading || !requestedPersonalOnly || isPersonalOnly) return;
    void navigate({
      to: "/projects",
      search: (previous) => ({
        ...previous,
        personal: undefined,
        private: undefined,
        preview: undefined,
      }),
    });
  }, [isPersonalOnly, navigate, requestedPersonalOnly, sessionQuery.isLoading]);

  useEffect(() => {
    const normalizedQuery = queryInput.trim();
    if (normalizedQuery === (search.query ?? "")) return;
    const timeoutId = window.setTimeout(() => {
      void navigate({
        to: "/projects",
        search: (previous) => ({
          ...previous,
          query: normalizedQuery || undefined,
          preview: undefined,
        }),
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [navigate, queryInput, search.query]);

  const handleShare = useCallback(async (project: RankedProject) => {
    const url =
      project.catalogUrl ??
      (typeof window !== "undefined"
        ? `${window.location.origin}/projects/${project.kind}/${project.slug}`
        : "");
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Copying links is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  }, []);

  const handlePreviewSelect = (projectId: string) => {
    void navigate({
      to: "/projects",
      search: (previous) => ({ ...previous, preview: projectId }),
    });
  };
  const closePreview = useCallback(() => {
    void navigate({
      to: "/projects",
      search: (previous) => ({ ...previous, preview: undefined }),
    });
  }, [navigate]);
  useEffect(() => {
    if (!selectedPreviewLookupFailed) return;
    toast.error("This entry is no longer available.");
    closePreview();
  }, [closePreview, selectedPreviewLookupFailed]);
  const handleProjectOpen = (project: RankedProject) => {
    handlePreviewSelect(project.id);
  };

  const handleKindChange = (kind: ProjectKindFilter) => {
    const nextVerified =
      search.verified && (kind === "all" || kind === "project") ? true : undefined;
    void navigate({
      to: "/projects",
      search: {
        ...search,
        kind,
        preview: undefined,
        verified: nextVerified,
        private: nextVerified ? undefined : search.private,
      },
    });
  };
  const handleSortChange = (sort: ProjectSort) => {
    void navigate({
      to: "/projects",
      search: (previous) => ({
        ...previous,
        sort: sort === "votes" ? undefined : sort,
        preview: undefined,
      }),
    });
  };
  const handleStatusChange = (status: ProjectStatusFilter) => {
    void navigate({
      to: "/projects",
      search: (previous) => ({
        ...previous,
        status: status === "all" ? undefined : status,
        preview: undefined,
      }),
    });
  };
  const handlePersonalToggle = () => {
    if (!canParticipate || !ownerFilterId) {
      toast.error("Connect a NEAR account to view personal entries.");
      return;
    }
    const nextPersonal = !isPersonalOnly;
    void navigate({
      to: "/projects",
      search: {
        ...search,
        personal: nextPersonal || undefined,
        private: nextPersonal && !isVerifiedOnly ? search.private : undefined,
        preview: undefined,
      },
    });
  };
  const handlePrivateToggle = () => {
    if (!isPersonalOnly || isVerifiedOnly) return;
    void navigate({
      to: "/projects",
      search: (previous) => ({
        ...previous,
        private: isPrivateOnly ? undefined : true,
        preview: undefined,
      }),
    });
  };
  const handleVerifiedToggle = () => {
    const nextVerified = !isVerifiedOnly;
    const nextKind =
      nextVerified && activeKind !== "all" && activeKind !== "project" ? "project" : activeKind;
    void navigate({
      to: "/projects",
      search: {
        ...search,
        kind: nextKind,
        verified: nextVerified || undefined,
        private: nextVerified ? undefined : search.private,
        preview: undefined,
      },
    });
  };
  const clearFilters = () => {
    void navigate({ to: "/projects", search: {} });
  };
  const runVote = (direction: "up" | "down", projectId: string) => {
    if (!canParticipate) {
      toast.error("Link an identity in settings before endorsing entries.");
      return;
    }
    if (direction === "up") upvoteMutation.mutate(projectId);
    else downvoteMutation.mutate(projectId);
  };

  const defaultNewKind = activeKind === "all" ? "project" : activeKind;
  const activeFilterCount = [
    Boolean(search.query),
    activeKind !== "all",
    isPersonalOnly,
    isPrivateOnly,
    isVerifiedOnly,
    activeStatus !== "all",
  ].filter(Boolean).length;
  const listSearch = { ...search, preview: undefined };

  return (
    <TooltipProvider>
      <div className="min-w-0">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <header>
            <div className="flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-4xl font-black tracking-tight text-foreground">Projects</h1>
                <p className="mt-2 text-base text-muted-foreground sm:text-lg">
                  Browse live projects, early ideas, scopes, and results from the NEAR builder
                  network.
                </p>
              </div>
              {canParticipate && (
                <Button asChild size="sm" className="shrink-0 self-start sm:self-auto">
                  <Link
                    to="/projects/new/$kind"
                    params={{ kind: defaultNewKind }}
                    search={{ ...listSearch, tab: "write" }}
                  >
                    <Plus className="size-4" />
                    New project
                  </Link>
                </Button>
              )}
            </div>

            <div className="mt-7 w-full">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Search projects, builders, repositories, or tags"
                  aria-label="Search projects"
                  className="h-12 rounded-xl bg-card pl-10 pr-10 text-base"
                />
                {queryInput && (
                  <button
                    type="button"
                    onClick={() => setQueryInput("")}
                    className="absolute right-3 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <div
                className="mt-5 flex justify-between border-b border-border sm:justify-start"
                role="tablist"
                aria-label="Project type"
              >
                {(
                  [
                    ["all", "All"],
                    ["project", "Projects"],
                    ["idea", "Ideas"],
                    ["scope", "Scopes"],
                    ["result", "Results"],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => handleKindChange(kind)}
                    role="tab"
                    aria-selected={activeKind === kind}
                    className={cn(
                      "relative inline-flex min-h-11 cursor-pointer items-center px-1.5 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-4 sm:pb-3 sm:pt-0 sm:text-sm",
                      activeKind === kind
                        ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-accent"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Select
                  value={activeStatus}
                  onValueChange={(value) => handleStatusChange(value as ProjectStatusFilter)}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label="Filter by status"
                    className="col-span-2 h-10 min-h-10 w-full shrink-0 rounded-xl bg-card px-3 whitespace-nowrap sm:col-span-1 sm:h-10 sm:min-h-10 sm:w-auto sm:rounded-full"
                  >
                    <Filter className="size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <FilterChip
                  active={isPersonalOnly}
                  disabled={!canParticipate || !ownerFilterId}
                  onClick={handlePersonalToggle}
                >
                  <User className="size-3.5" />
                  Personal
                </FilterChip>
                <FilterChip active={isVerifiedOnly} onClick={handleVerifiedToggle}>
                  <Sparkles className="size-3.5" />
                  Catalog verified
                </FilterChip>
                {isPersonalOnly && !isVerifiedOnly && (
                  <FilterChip active={isPrivateOnly} onClick={handlePrivateToggle}>
                    <Lock className="size-3.5" />
                    Private
                  </FilterChip>
                )}
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="col-span-2 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:col-span-1 sm:ml-auto"
                  >
                    Clear filters
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="mt-9">
            <div className="w-full">
              <section className="w-full overflow-hidden rounded-xl border border-border bg-card">
                <div>
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <ProjectListLabel kind={activeKind} />
                      </span>
                      <ProjectCount
                        total={totalProjectCount || rankedProjects.length}
                        loaded={rankedProjects.length}
                      />
                    </div>
                    <Select
                      value={activeSort}
                      onValueChange={(value) => handleSortChange(value as ProjectSort)}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="Sort entries"
                        className="h-8 w-auto gap-1.5 rounded-full border-border bg-secondary px-3 text-xs font-semibold [&>svg:last-child]:hidden"
                      >
                        <ArrowDownUp className="size-3.5 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="votes">Most endorsed</SelectItem>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="oldest">Oldest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!isProjectsLoading && !isProjectsError && upvoteCounts.isError && (
                    <VoteDataNotice />
                  )}
                  {isProjectsLoading || isRankingLoading ? (
                    <ProjectLoadingState sort={activeSort} />
                  ) : isProjectsError ? (
                    <ProjectErrorState
                      onRetry={() => void retryProjects()}
                      isRetrying={isFetching || isCatalogFetching}
                    />
                  ) : rankedProjects.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <Search className="mx-auto size-5 text-muted-foreground" />
                      <h2 className="mt-3 text-sm font-bold text-foreground">
                        {search.query
                          ? "No matching entries"
                          : isVerifiedOnly
                            ? "No verified projects yet"
                            : "No entries in this view"}
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {search.query
                          ? "Try a shorter search or clear the filters."
                          : isVerifiedOnly
                            ? getCatalogEmptyMessage(activeStatus)
                            : "Published projects and ideas will appear here."}
                      </p>
                    </div>
                  ) : (
                    <div>
                      {rankedProjects.map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          isSelected={project.id === selectedPreviewId}
                          voteCountAvailable={voteCountAvailable}
                          onOpen={() => handleProjectOpen(project)}
                        />
                      ))}
                    </div>
                  )}

                  {!isProjectsLoading &&
                    !isProjectsError &&
                    isProjectsPaginationError &&
                    rankedProjects.length > 0 && (
                      <ProjectPaginationError
                        ranking={activeSort === "votes"}
                        onRetry={() => void retryProjects()}
                        isRetrying={isFetching || isCatalogFetching}
                      />
                    )}

                  {!isProjectsLoading &&
                    !isRankingLoading &&
                    !isProjectsError &&
                    !isProjectsPaginationError &&
                    rankedProjects.length > 0 && (
                      <div ref={sentinelRef} className="flex justify-center py-5">
                        {isFetchingMoreProjects ? (
                          <div className="size-5 animate-spin rounded-full border-2 border-border border-t-transparent" />
                        ) : hasMoreProjects ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void fetchMoreProjects()}
                          >
                            Load more
                            <ArrowUpRight className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    )}
                </div>
              </section>
            </div>
          </main>

          <Sheet
            open={Boolean(selectedProject)}
            onOpenChange={(open) => {
              if (!open) closePreview();
            }}
          >
            <SheetContent side="right" hideCloseButton className="w-full max-w-xl p-0 sm:max-w-xl">
              {selectedProject && (
                <>
                  <ProjectPreviewHeader title={selectedProject.title} />
                  <div className="absolute right-5 top-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={closePreview}
                      aria-label="Close project details"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <ProjectDetailPanel
                      project={selectedProject}
                      detail={selectedProjectQuery.data?.data}
                      readme={selectedReadmeQuery.data}
                      isReadmeLoading={selectedReadmeQuery.isLoading}
                      isReadmeError={selectedReadmeQuery.isError}
                      voteCountAvailable={voteCountAvailable}
                      voteDirection={userVoteMap[selectedProject.id] ?? null}
                      canParticipate={canParticipate}
                      canManage={canManageSelected}
                      isUpvoting={
                        upvoteMutation.isPending && upvoteMutation.variables === selectedProject.id
                      }
                      isDownvoting={
                        downvoteMutation.isPending &&
                        downvoteMutation.variables === selectedProject.id
                      }
                      copied={copied}
                      search={search}
                      onVote={(direction) => runVote(direction, selectedProject.id)}
                      onShare={() => handleShare(selectedProject)}
                    />
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>

          {!canParticipate && (
            <div className="mt-4 border-t border-border pt-3 text-center text-xs text-muted-foreground lg:hidden">
              Anonymous sessions can browse.{" "}
              <Link to="/settings" className="font-semibold text-brand-accent hover:underline">
                Link an identity
              </Link>{" "}
              to publish and endorse entries.
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
