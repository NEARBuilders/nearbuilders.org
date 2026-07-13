import { BarChart2, FileText, Globe, Layers, Lock, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { NewBadge } from "@/components/ui/new-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VoteButton } from "@/components/ui/vote-button";
import { cn } from "@/lib/utils";

export type VoteDirection = "up" | "down" | null;
export type ProjectKind = "project" | "idea" | "scope" | "result";

export interface ProjectDirectoryItem {
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
  source: "local" | "nearcatalog";
  catalogUrl: string | null;
  imageUrl: string | null;
  contributors: { nearAccount: string; roles: string[] }[];
}

export function isGithubUrl(url: string) {
  return /github\.com/i.test(url);
}

export function GithubIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.165c-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.52 11.52 0 0 1 12 6.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.218.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function ProjectDirectoryListRow({
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
  project: ProjectDirectoryItem;
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
        <ProjectImage project={project} />
        <ProjectDirectoryRowContent project={project} compact />
      </button>
      <button
        type="button"
        onClick={onDesktopSelect}
        className="hidden lg:flex flex-1 min-w-0 items-center gap-2 cursor-pointer bg-transparent border-none p-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ProjectImage project={project} />
        <ProjectDirectoryRowContent project={project} />
      </button>
      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-1 py-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <VoteButton
              icon={<ThumbsUp size={13} strokeWidth={2.25} />}
              onClick={onUpvote}
              label="Upvote"
              disabled={isUpvoting}
              active={voteDirection === "up"}
              activeColor="text-brand-accent"
              size="compact"
            />
          </TooltipTrigger>
          <TooltipContent>Endorse this entry</TooltipContent>
        </Tooltip>
        <span className="min-w-[20px] text-center text-[11px] font-bold leading-none text-foreground">
          {project.upvoteCount}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <VoteButton
              icon={<ThumbsDown size={13} strokeWidth={2.25} />}
              onClick={onDownvote}
              label="Downvote"
              disabled={isDownvoting}
              active={voteDirection === "down"}
              activeColor="text-destructive"
              size="compact"
            />
          </TooltipTrigger>
          <TooltipContent>Remove your endorsement</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ProjectImage({ project }: { project: ProjectDirectoryItem }) {
  return project.imageUrl ? (
    <img
      src={project.imageUrl}
      alt=""
      className="size-9 shrink-0 rounded-md border border-border object-cover"
    />
  ) : null;
}

function ProjectDirectoryRowContent({
  project,
  compact = false,
}: {
  project: ProjectDirectoryItem;
  compact?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <KindBadge kind={project.kind} compact={compact} size={compact ? "default" : "sidebar"} />
        {project.source === "nearcatalog" && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            Catalog
          </Badge>
        )}
        <span className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">
          {project.title}
        </span>
        <NewBadge createdAt={project.createdAt} compact />
        {project.visibility === "private" && <PrivateIndicator size={11} />}
        {!compact && project.repository && (
          <a
            href={project.repository}
            target="_blank"
            rel="noopener noreferrer"
            title={project.repository}
            onClick={(event) => event.stopPropagation()}
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
  );
}

export function PrivateIndicator({ size = 12 }: { size?: number }) {
  return (
    <span
      title="Private"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-secondary p-1 text-muted-foreground"
    >
      <Lock size={size} />
    </span>
  );
}

export function KindBadge({
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

export function StatusBadge({ status }: { status: "active" | "paused" | "archived" }) {
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
