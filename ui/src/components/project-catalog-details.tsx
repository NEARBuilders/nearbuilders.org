import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useApiClient } from "@/app";
import { socialIcon } from "@/components/ui/social-icons";
import {
  type CatalogReadinessInput,
  catalogCategoriesQueryOptions,
  getCatalogLinks,
  getCatalogPhaseLabel,
  getCatalogReadiness,
  type ProjectCatalog,
} from "@/lib/project-catalog";

export function ProjectCatalogCard({
  project,
  canManage,
  action,
}: {
  project: CatalogReadinessInput & { catalog?: ProjectCatalog | null };
  canManage: boolean;
  action?: ReactNode;
}) {
  const catalog = project.catalog;
  const categories = catalog?.categories ?? [];
  const apiClient = useApiClient();
  const categoriesQuery = useQuery({
    ...catalogCategoriesQueryOptions(apiClient),
    enabled: categories.length > 0,
  });

  const phase = getCatalogPhaseLabel(catalog?.phase);
  const links = getCatalogLinks(catalog);
  const readiness = getCatalogReadiness(project);
  const showMissing = canManage && !readiness.ready;
  const hasDetails =
    Boolean(catalog?.tagline || phase || catalog?.tokenContract || catalog?.coingeckoId) ||
    categories.length > 0 ||
    links.length > 0;

  if (!hasDetails && !showMissing) return null;

  const categoryLabels = categories.map(
    (id) => categoriesQuery.data?.find((category) => category.id === id)?.label ?? id,
  );
  const facts = [
    { label: "Phase", value: phase },
    { label: "Categories", value: categoryLabels.join(", ") },
    { label: "Token", value: catalog?.tokenContract, mono: true },
    { label: "CoinGecko", value: catalog?.coingeckoId, mono: true },
  ].filter((fact) => fact.value);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="text-xs font-bold uppercase tracking-12 text-brand-accent">NEAR Catalog</h2>

      {catalog?.tagline && (
        <p className="mt-3 text-base leading-relaxed text-foreground">{catalog.tagline}</p>
      )}

      {facts.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className={fact.mono ? "font-mono text-foreground" : "text-foreground"}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {links.map((link) => {
            const Icon = socialIcon(link.key);
            return (
              <a
                key={link.key}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-foreground hover:underline"
              >
                <Icon className="size-3.5 text-muted-foreground" />
                {link.label}
                <ExternalLink size={11} className="text-muted-foreground" />
              </a>
            );
          })}
        </div>
      )}

      {showMissing && (
        <div
          className={
            hasDetails
              ? "mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
              : "mt-3 flex flex-wrap items-center justify-between gap-3"
          }
        >
          <p className="text-xs text-muted-foreground">
            Missing for a listing:{" "}
            {readiness.missing.map((item) => item.label.toLowerCase()).join(", ")}. Only you and
            your collaborators see this.
          </p>
          {action}
        </div>
      )}
    </section>
  );
}
