import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useApiClient } from "@/app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CATALOG_LINKS,
  CATALOG_PHASES,
  type CatalogReadinessInput,
  catalogCategoriesQueryOptions,
  getCatalogReadiness,
  type ProjectCatalog,
} from "@/lib/project-catalog";

export function ProjectCatalogDetails({ catalog }: { catalog?: ProjectCatalog | null }) {
  const apiClient = useApiClient();
  const categoriesQuery = useQuery({
    ...catalogCategoriesQueryOptions(apiClient),
    enabled: (catalog?.categories?.length ?? 0) > 0,
  });
  if (!catalog) return null;

  const labelFor = (id: string) =>
    categoriesQuery.data?.find((category) => category.id === id)?.label ?? id;
  const phase = CATALOG_PHASES.find((item) => item.value === catalog.phase)?.label;
  const links = CATALOG_LINKS.flatMap(({ key, label }) => {
    const href = catalog.links?.[key];
    return href ? [{ key, label, href }] : [];
  });
  const hasTags = Boolean(phase) || (catalog.categories?.length ?? 0) > 0;

  return (
    <div className="space-y-2">
      {catalog.tagline && <p className="text-sm text-foreground">{catalog.tagline}</p>}
      {hasTags && (
        <div className="flex flex-wrap items-center gap-1.5">
          {phase && (
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-xs">
              {phase}
            </Badge>
          )}
          {catalog.categories?.map((id) => (
            <Badge key={id} variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs">
              {labelFor(id)}
            </Badge>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Button key={link.key} asChild size="sm" variant="outline" className="w-fit">
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                <span>{link.label}</span>
                <ExternalLink size={11} className="shrink-0 text-muted-foreground" />
              </a>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectCatalogReadiness({
  project,
  action,
}: {
  project: CatalogReadinessInput;
  action?: ReactNode;
}) {
  const readiness = getCatalogReadiness(project);
  if (readiness.ready) return null;

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium text-foreground">Not ready for NEAR Catalog yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Only you and your collaborators see this. Add the missing details to get it ready.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {readiness.items.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs">
            {item.complete ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-brand-accent" />
            ) : (
              <Circle className="size-3.5 shrink-0 text-border-strong" />
            )}
            <span className={item.complete ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
