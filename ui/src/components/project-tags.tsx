import { useQuery } from "@tanstack/react-query";
import { BarChart2, BookCheck, FileText, Layers, Lock } from "lucide-react";
import { useApiClient } from "@/app";
import type { ProjectDirectoryItem, ProjectKind } from "@/components/project-directory-item";
import { Badge } from "@/components/ui/badge";
import { NewBadge } from "@/components/ui/new-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { catalogListingsQueryOptions, findCatalogListing } from "@/lib/catalog-listing";
import { cn } from "@/lib/utils";

export type ProjectTagsSource = Pick<
  ProjectDirectoryItem,
  "kind" | "status" | "createdAt" | "visibility"
> & {
  id?: string;
  source?: ProjectDirectoryItem["source"];
};

export function ProjectTags({ project }: { project: ProjectTagsSource }) {
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
          <Badge variant="outline" className="rounded-full border px-2 py-0.5 text-2xs">
            Catalog
          </Badge>
        </span>
      )}
      {project.source !== "nearcatalog" && project.kind === "project" && project.id && (
        <CatalogListedBadge kind="project" entityId={project.id} />
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

export function CatalogListedBadge({
  kind,
  entityId,
  linked = false,
  className,
}: {
  kind: "project" | "person";
  entityId: string;
  linked?: boolean;
  className?: string;
}) {
  const apiClient = useApiClient();
  const { data } = useQuery(catalogListingsQueryOptions(apiClient, kind));
  const listing = findCatalogListing(data, entityId);
  if (!listing) return null;

  const published = listing.status === "published";
  const subject = kind === "person" ? "builder" : "project";
  const label = "On NEAR Catalog";
  const description = published
    ? `A NEAR Builders admin approved this ${subject} and it is listed on NEAR Catalog.`
    : `A NEAR Builders admin approved this ${subject} for NEAR Catalog.`;
  const badge = (
    <Badge
      variant="outline"
      aria-label={`${label}. ${description}`}
      className={cn(
        "gap-1 rounded-full border-brand-accent-border bg-brand-accent-light px-2 py-0.5 text-2xs text-foreground [&>svg]:size-2.5",
        className,
      )}
    >
      <BookCheck className="text-brand-accent" />
      {label}
    </Badge>
  );
  const href = linked && published ? listing.catalogUrl : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
              {badge}
            </a>
          ) : (
            <span className="shrink-0">{badge}</span>
          )}
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PrivateIndicator({ size = 12 }: { size?: number }) {
  return (
    <span
      title="Private"
      role="img"
      aria-label="Private"
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
  className,
}: {
  kind: ProjectKind;
  compact?: boolean;
  size?: "default" | "sidebar";
  className?: string;
}) {
  const isCompact = compact ?? size === "sidebar";
  const KindIcon =
    kind === "idea" ? FileText : kind === "scope" ? Layers : kind === "result" ? BarChart2 : null;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 rounded-2xs border-border text-foreground",
        kind === "idea" || kind === "scope" || kind === "result" ? "bg-muted" : "bg-secondary",
        size === "sidebar"
          ? "gap-1 px-2 py-0.5 text-2xs [&>svg]:size-2.5"
          : isCompact
            ? "gap-0.5 px-1.5 py-0 text-3xs [&>svg]:size-2.25"
            : "gap-1 px-2 py-0.5 text-2xs [&>svg]:size-2.5",
        className,
      )}
    >
      {KindIcon ? <KindIcon /> : null}
      {kind}
    </Badge>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: "active" | "paused" | "archived";
  className?: string;
}) {
  const statusClasses = {
    active: "border-brand-accent bg-brand-accent-light text-foreground",
    paused: "border-border bg-secondary text-foreground",
    archived: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  return (
    <Badge
      variant="outline"
      className={cn("rounded-2xs px-2 py-0.5 text-2xs", statusClasses[status], className)}
    >
      {status}
    </Badge>
  );
}
