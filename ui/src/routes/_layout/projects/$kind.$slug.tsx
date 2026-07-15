import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { getSocialImageMeta } from "everything-dev/ui/metadata";
import {
  ArrowLeft,
  BarChart2,
  Check,
  ExternalLink,
  FileCode2,
  FileText,
  Globe,
  Info,
  Layers,
  Lock,
  Pencil,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { ProjectReviewStatus } from "@/components/project-review-status";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { NewBadge } from "@/components/ui/new-badge";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VoteButton } from "@/components/ui/vote-button";
import { fetchRepositoryReadme } from "@/lib/repository-content";
import { getAssetUrl, getSiteUrl } from "@/lib/site-url";
import { isProjectKind, parseProjectListSearch } from "./-search";

export const Route = createFileRoute("/_layout/projects/$kind/$slug")({
  validateSearch: parseProjectListSearch,
  beforeLoad: async ({ params }) => {
    if (!isProjectKind(params.kind)) throw redirect({ to: "/projects" });
  },
  loader: async ({ params, context }) => {
    const project = await context.queryClient
      .ensureQueryData({
        queryKey: ["project", params.slug],
        queryFn: () => context.apiClient.getProjectBySlug({ slug: params.slug }),
      })
      .then((r) => r?.data ?? null)
      .catch(() => null);

    return {
      project,
      siteName: context.runtimeConfig?.runtime?.title ?? "NEAR Builders",
      siteUrl: getSiteUrl(context.runtimeConfig, `/projects/${params.kind}/${params.slug}`),
      imageUrl: getAssetUrl(context.runtimeConfig, "/metadata.png"),
    };
  },
  head: ({ loaderData }) => {
    const project = loaderData?.project;
    const siteName = loaderData?.siteName ?? "NEAR Builders";
    const title = project ? `${project.title} | ${siteName}` : `Project | ${siteName}`;
    const description =
      project?.description?.trim() ||
      (project ? `${project.title} on ${siteName}.` : "Project details on NEAR Builders.");

    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...getSocialImageMeta({
          imageUrl: loaderData?.imageUrl ?? "/metadata.png",
          title: project?.title ?? "Project",
          description,
          siteName,
          siteUrl: loaderData?.siteUrl,
          type: "article",
          alt: description,
        }),
      ],
    };
  },
  component: ProjectDetailPage,
});

function isGithubUrl(url: string) {
  return /github\.com/i.test(url);
}

function GithubIcon({ size = 14 }: { size?: number }) {
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

function ProjectDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const search = Route.useSearch();

  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();

  const projectQuery = useQuery({
    queryKey: ["project", slug],
    queryFn: () => apiClient.getProjectBySlug({ slug }),
  });

  const project = projectQuery.data?.data;
  const projectId = project?.id;
  const canParticipate = Boolean(session?.user && !session.user.isAnonymous);

  const readmeQuery = useQuery({
    queryKey: ["readme", project?.id, project?.repository],
    queryFn: async () => {
      if (!project?.repository) return null;
      return await fetchRepositoryReadme(project.repository);
    },
    enabled: project?.kind === "project" && Boolean(project?.repository),
  });

  const upvoteCountQuery = useQuery({
    queryKey: ["upvoteCount", projectId],
    queryFn: () => apiClient.getUpvoteCount({ entityId: projectId! }),
    enabled: Boolean(projectId),
  });

  const userVoteQuery = useQuery({
    queryKey: ["userVoteState", projectId],
    queryFn: () => apiClient.getUserVote({ entityId: projectId! }),
    select: (data): "up" | "down" | null => (data.hasUpvote ? "up" : null),
    enabled: canParticipate && Boolean(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteProject({ id: projectId! }),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({
        to: "/projects",
        search: {
          preview: undefined,
          kind: search.kind,
          personal: search.personal,
          private: search.private,
        },
      });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  const upvoteMutation = useMutation({
    mutationFn: () => apiClient.upvote({ entityId: projectId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upvoteCount", projectId] });
      queryClient.invalidateQueries({ queryKey: ["upvoteCounts"] });
      queryClient.setQueryData(["userVoteState", projectId], {
        entityId: projectId,
        hasUpvote: true,
      });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to upvote"),
  });

  const downvoteMutation = useMutation({
    mutationFn: () => apiClient.downvote({ entityId: projectId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upvoteCount", projectId] });
      queryClient.invalidateQueries({ queryKey: ["upvoteCounts"] });
      queryClient.setQueryData(["userVoteState", projectId], {
        entityId: projectId,
        hasUpvote: false,
      });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to downvote"),
  });

  const runVote = (direction: "up" | "down") => {
    if (!canParticipate) {
      toast.error("Link an identity in settings before voting.");
      return;
    }
    if (direction === "up") upvoteMutation.mutate();
    else downvoteMutation.mutate();
  };

  const handleShare = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="h-5 w-30 rounded animate-pulse bg-secondary" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <div className="h-8 w-60 rounded-md animate-pulse bg-secondary" />
          <div className="h-4 w-[70%] rounded animate-pulse bg-secondary" />
          <div className="h-4 w-1/2 rounded animate-pulse bg-secondary" />
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] flex-col items-center justify-center gap-4 p-6">
        <p className="text-base font-semibold text-foreground">Project not found.</p>
        <Link
          to="/projects"
          search={{
            preview: undefined,
            kind: search.kind,
            personal: search.personal,
            private: search.private,
          }}
          className="text-sm font-bold text-brand-accent hover:underline"
        >
          {"\u2190"} Back to projects
        </Link>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "admin";
  const isOwner = isCurrentUserOwner(project.ownerId, session?.user, nearAccountId);
  const canManage = isAdmin || isOwner;
  const voteCount = upvoteCountQuery.data?.totalCount ?? 0;
  const voteDirection = userVoteQuery.data ?? null;

  const renderedContent =
    project.kind === "idea" || project.kind === "scope" || project.kind === "result"
      ? project.content
      : (readmeQuery.data ?? project.description ?? null);

  const metaItems = (
    <div className="space-y-4">
      <MetaSectionLabel>Details</MetaSectionLabel>
      <MetaItem label="Visibility" value={project.visibility} />
      <MetaItem label="Owner" value={shortenId(project.ownerId)} mono />
      <MetaLinkItem
        label="Builder"
        to="/builders/$account"
        params={{ account: project.ownerId }}
        value={shortenId(project.ownerId)}
        mono
      />
      <MetaItem label="Slug" value={project.slug} mono />
      {project.domain && <MetaItem label="Domain" value={project.domain} mono />}
      <MetaItem label="Created" value={formatDate(project.createdAt)} />
      <MetaItem label="Updated" value={formatDate(project.updatedAt)} />
    </div>
  );

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        {/* top bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5 sm:px-6 sm:py-3">
          {/* breadcrumb */}
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon-sm" aria-label="Back to projects">
              <Link
                to="/projects"
                search={{
                  preview: project.id,
                  kind: search.kind,
                  personal: search.personal,
                  private: search.private,
                }}
              >
                <ArrowLeft size={15} />
              </Link>
            </Button>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="hidden max-w-[160px] truncate text-sm font-semibold text-foreground sm:block">
              {project.slug}
            </span>
          </div>

          {/* actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* vote widget */}
            <div className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 bg-secondary">
              <Tooltip>
                <TooltipTrigger asChild>
                  <VoteButton
                    icon={<ThumbsUp size={18} strokeWidth={2.25} />}
                    onClick={() => runVote("up")}
                    label="Upvote"
                    disabled={!canParticipate || upvoteMutation.isPending}
                    active={voteDirection === "up"}
                    activeColor="text-brand-accent"
                  />
                </TooltipTrigger>
                <TooltipContent>Endorse this entry</TooltipContent>
              </Tooltip>
              <span className="min-w-5 text-center text-[13px] font-bold text-foreground">
                {voteCount}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <VoteButton
                    icon={<ThumbsDown size={18} strokeWidth={2.25} />}
                    onClick={() => runVote("down")}
                    label="Downvote"
                    disabled={!canParticipate || downvoteMutation.isPending}
                    active={voteDirection === "down"}
                    activeColor="text-destructive"
                  />
                </TooltipTrigger>
                <TooltipContent>Remove your endorsement</TooltipContent>
              </Tooltip>
            </div>

            {/* repo link */}
            {project.repository && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden sm:inline-flex max-w-[160px]"
              >
                <a
                  href={project.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={project.repository}
                >
                  {isGithubUrl(project.repository) ? <GithubIcon size={13} /> : <Globe size={13} />}
                  <span className="truncate">
                    {project.repository
                      .replace(/^https?:\/\/(www\.)?/, "")
                      .split("/")
                      .slice(0, 2)
                      .join("/")}
                  </span>
                </a>
              </Button>
            )}

            {/* share */}
            <VoteButton
              icon={copied ? <Check size={14} /> : <Share2 size={14} />}
              onClick={handleShare}
              label={copied ? "Link copied" : "Copy link"}
              active={copied}
              activeColor="text-brand-accent"
            />

            {/* details sheet trigger */}
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="sm:hidden"
              onClick={() => setDetailsOpen(true)}
              aria-label="Show details"
            >
              <Info size={15} />
            </Button>

            {canManage && (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/projects/$kind/$slug/edit"
                    params={{ kind: project.kind, slug: project.slug }}
                    search={{
                      tab: "write",
                      kind: search.kind,
                      personal: search.personal,
                      private: search.private,
                    }}
                  >
                    <Pencil size={13} />
                    <span className="hidden sm:inline">Edit</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Delete this project permanently?")) deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </>
            )}
          </div>
        </div>
        {/* body */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* main content */}
          <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
            <div className="mx-auto max-w-3xl space-y-4">
              <ProjectReviewStatus projectId={project.id} visible={isOwner} />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <KindChip kind={project.kind} />
                  {project.kind !== "result" && project.status !== "active" && (
                    <StatusChip status={project.status} />
                  )}
                  <NewBadge createdAt={project.createdAt} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[26px] sm:text-[30px] font-semibold leading-tight text-foreground">
                    {project.title}
                  </h1>
                  {project.visibility === "private" && <PrivateIndicator />}
                </div>
                {project.description && (
                  <p className="text-[15px] leading-relaxed text-muted-foreground">
                    {project.description}
                  </p>
                )}
                {project.repository && (
                  <Button asChild size="sm" variant="outline" className="w-fit">
                    <a href={project.repository} target="_blank" rel="noopener noreferrer">
                      {isGithubUrl(project.repository) ? (
                        <GithubIcon size={13} />
                      ) : (
                        <Globe size={13} />
                      )}
                      <span className="max-w-[220px] truncate">
                        {project.repository.replace(/^https?:\/\/(www\.)?/, "")}
                      </span>
                      <ExternalLink size={11} className="text-muted-foreground shrink-0" />
                    </a>
                  </Button>
                )}
              </div>

              <div className="h-px bg-border" />

              {project.kind === "project" && readmeQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading README\u2026</p>
              ) : renderedContent ? (
                <Markdown content={renderedContent} />
              ) : (
                <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
                  {project.kind === "project"
                    ? "No README available for this repository."
                    : project.kind === "scope"
                      ? "This scope has no content yet."
                      : project.kind === "result"
                        ? "This result has no content yet."
                        : "This idea has no content yet."}
                </div>
              )}

              {(project.kind === "scope" || project.kind === "result") && (
                <MentionsSection projectId={project.id} />
              )}
            </div>
          </div>

          {/* desktop sidebar */}
          <div className="hidden sm:block w-[220px] shrink-0 border-l border-border overflow-y-auto bg-muted px-5 py-6">
            {metaItems}
          </div>
        </div>
        {/* mobile details sheet */}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent side="bottom" hideCloseButton={false}>
            <SheetHeader>
              <SheetTitle>Details</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-5 pb-2 pt-1">
              <div className="space-y-4">
                <MetaItem label="Visibility" value={project.visibility} />
                <MetaItem label="Owner" value={shortenId(project.ownerId)} mono />
                <MetaLinkItem
                  label="Builder"
                  to="/builders/$account"
                  params={{ account: project.ownerId }}
                  value={shortenId(project.ownerId)}
                  mono
                />
                <MetaItem label="Slug" value={project.slug} mono />
                {project.domain && <MetaItem label="Domain" value={project.domain} mono />}
                <MetaItem label="Created" value={formatDate(project.createdAt)} />
                <MetaItem label="Updated" value={formatDate(project.updatedAt)} />
              </div>
            </div>
            <div
              className="shrink-0 px-5 pt-3"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
            >
              <SheetClose asChild>
                <Button variant="outline" className="w-full">
                  Close
                </Button>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}

function PrivateIndicator() {
  return (
    <span
      title="Private"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary p-1 text-muted-foreground"
    >
      <Lock size={12} />
    </span>
  );
}

function KindChip({ kind }: { kind: "project" | "idea" | "scope" | "result" }) {
  const icons = {
    idea: <FileText size={11} />,
    project: <FileCode2 size={11} />,
    scope: <Layers size={11} />,
    result: <BarChart2 size={11} />,
  };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold border border-border bg-secondary text-foreground">
      {icons[kind]}
      {kind}
    </span>
  );
}

function MentionsSection({ projectId }: { projectId: string }) {
  const apiClient = useApiClient();

  const mentionedByQuery = useQuery({
    queryKey: ["mentionedBy", projectId],
    queryFn: () => apiClient.listMentionedBy({ id: projectId }),
  });

  const mentionsQuery = useQuery({
    queryKey: ["mentions", projectId],
    queryFn: () => apiClient.listMentions({ id: projectId }),
  });

  const mentioned = mentionedByQuery.data?.data ?? [];
  const mentioners = mentionsQuery.data?.data ?? [];

  if (mentioned.length === 0 && mentioners.length === 0) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="h-px bg-border" />
      {mentioned.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Mentions
          </div>
          <div className="flex flex-wrap gap-2">
            {mentioned.map((item) => (
              <MentionChip key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
      {mentioners.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Referenced by
          </div>
          <div className="flex flex-wrap gap-2">
            {mentioners.map((item) => (
              <MentionChip key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MentionChip({
  item,
}: {
  item: { id: string; kind: string; title: string; slug: string };
}) {
  const kindIcons: Record<string, ReactNode> = {
    idea: <FileText size={11} />,
    project: <FileCode2 size={11} />,
    scope: <Layers size={11} />,
    result: <BarChart2 size={11} />,
  };
  return (
    <Link
      to="/projects/$kind/$slug"
      params={{ kind: item.kind, slug: item.slug }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
    >
      <span className="text-muted-foreground">{kindIcons[item.kind]}</span>
      {item.title}
    </Link>
  );
}

function StatusChip({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: "border-brand-accent-border bg-brand-accent-light text-foreground",
    paused: "border-border bg-secondary text-foreground",
    archived: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold border ${variants[status] ?? "border-border bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function MetaSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </div>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`text-[13px] text-foreground break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function MetaLinkItem({
  label,
  to,
  params,
  value,
  mono,
}: {
  label: string;
  to: string;
  params: Record<string, string>;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <Link
        to={to}
        params={params}
        className={`text-[13px] text-brand-cyan hover:underline break-all ${mono ? "font-mono" : ""}`}
      >
        {value}
      </Link>
    </div>
  );
}

function shortenId(id: string): string {
  if (id.length <= 20) return id;
  return `${id.slice(0, 8)}\u2026${id.slice(-6)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
