import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import { ProjectTags } from "@/components/project-tags";
import { ProjectVisual } from "@/components/project-visual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type FeaturedProject, getProjectAppUrl } from "@/lib/queries/featured-projects";

export function GetInvolvedCard({ project }: { project: FeaturedProject }) {
  const appUrl = getProjectAppUrl(project);

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <ProjectVisual
          project={{ ownerId: project.ownerId, imageUrl: project.logoUrl, title: project.title }}
          className="size-12 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <ProjectTags project={project} />
          <h3 className="mt-2 truncate text-lg font-black tracking-tight text-foreground">
            <Link
              to="/projects/$kind/$slug"
              params={{ kind: project.kind, slug: project.slug }}
              className="transition-colors hover:text-brand-accent"
            >
              {project.title}
            </Link>
          </h3>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {project.description || "No description added yet."}
      </p>
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/projects/$kind/$slug" params={{ kind: project.kind, slug: project.slug }}>
            View project
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {appUrl && (
          <Button asChild variant="outline" className="rounded-full">
            <a href={appUrl} target="_blank" rel="noopener noreferrer">
              Open app
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

export function GetInvolvedCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="size-12 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <Skeleton className="mt-6 h-9 w-32 rounded-full" />
    </div>
  );
}
