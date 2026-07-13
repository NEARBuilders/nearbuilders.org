import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { claimedCatalogProjectsQueryOptions } from "@/lib/queries/catalog";

export function ContributedProjects({ nearAccount }: { nearAccount: string }) {
  const apiClient = useApiClient();
  const query = useQuery(claimedCatalogProjectsQueryOptions(apiClient, nearAccount));
  const projects = query.data?.data ?? [];

  if (!query.isLoading && projects.length === 0) return null;

  return (
    <section className="mt-8" aria-labelledby="contributed-projects-heading">
      <div className="mb-3">
        <h2 id="contributed-projects-heading" className="text-lg font-bold text-foreground">
          Contributed projects
        </h2>
        <p className="text-sm text-muted-foreground">
          Verified contributions to projects maintained in NEAR Catalog.
        </p>
      </div>
      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map(({ project, contributors }) => {
            const roles = contributors.flatMap((contributor) => contributor.roles);
            return (
              <article
                key={project.projectRef}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  {project.imageUrl ? (
                    <img
                      src={project.imageUrl}
                      alt=""
                      className="size-12 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary font-semibold text-secondary-foreground">
                      {project.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-foreground">{project.name}</h3>
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="size-3" />
                        Verified
                      </Badge>
                    </div>
                    {project.tagline && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {project.tagline}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Array.from(new Set(roles)).map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {project.repositoryUrl && (
                    <a
                      href={project.repositoryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-accent"
                    >
                      Repository
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  <a
                    href={project.catalogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-foreground hover:text-brand-accent"
                  >
                    NEAR Catalog
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
