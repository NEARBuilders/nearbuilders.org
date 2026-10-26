import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiClient } from "@/app";
import { Input } from "@/components";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATALOG_CATEGORIES_MAX,
  CATALOG_LINKS,
  CATALOG_PHASES,
  CATALOG_TAGLINE_MAX,
  type CatalogPhase,
  catalogCategoriesQueryOptions,
  getCatalogReadiness,
  getProjectCatalogErrors,
  type ProjectCatalogFormValues,
  projectCatalogFromFormValues,
} from "@/lib/project-catalog";
import { cn } from "@/lib/utils";

const NO_PHASE = "none";

export function ProjectCatalogFields({
  value,
  onChange,
  description,
  logoUrl,
  showErrors,
}: {
  value: ProjectCatalogFormValues;
  onChange: (next: ProjectCatalogFormValues) => void;
  description?: string;
  logoUrl?: string;
  showErrors: boolean;
}) {
  const apiClient = useApiClient();
  const categoriesQuery = useQuery(catalogCategoriesQueryOptions(apiClient));
  const [filter, setFilter] = useState("");
  const errors = getProjectCatalogErrors(value);
  const readiness = getCatalogReadiness({
    description,
    logoUrl,
    catalog: projectCatalogFromFormValues(value),
  });

  const categories = categoriesQuery.data ?? [];
  const labelFor = (id: string) => categories.find((category) => category.id === id)?.label ?? id;
  const visibleCategories = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return categories.filter(
      (category) =>
        !value.categories.includes(category.id) &&
        (!needle || category.label.toLowerCase().includes(needle) || category.id.includes(needle)),
    );
  }, [categories, filter, value.categories]);

  const update = (patch: Partial<ProjectCatalogFormValues>) => onChange({ ...value, ...patch });
  const toggleCategory = (id: string) => {
    const selected = value.categories.includes(id);
    if (!selected && value.categories.length >= CATALOG_CATEGORIES_MAX) return;
    update({
      categories: selected
        ? value.categories.filter((category) => category !== id)
        : [...value.categories, id],
    });
  };
  const errorFor = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
      <Label>NEAR Catalog</Label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Optional. These are the details NEAR Catalog lists for a project, so it can go there later
        without retyping.
      </p>

      <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-xs font-medium text-foreground">
          {readiness.ready ? "Ready for NEAR Catalog" : "Needed for NEAR Catalog"}
        </p>
        <div className="grid grid-cols-1 gap-1.5">
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
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="catalog-tagline">Tagline</Label>
        <Input
          id="catalog-tagline"
          value={value.tagline}
          onChange={(e) => update({ tagline: e.target.value })}
          placeholder="One line about what it does"
          aria-invalid={Boolean(errorFor("tagline"))}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="text-destructive">{errorFor("tagline")}</span>
          <span>
            {value.tagline.trim().length}/{CATALOG_TAGLINE_MAX}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="catalog-category-filter">
          Categories{" "}
          <span className="font-normal text-muted-foreground">
            (up to {CATALOG_CATEGORIES_MAX})
          </span>
        </Label>
        {value.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.categories.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleCategory(id)}
                className="rounded-full border border-brand-accent-border bg-brand-accent-light px-3 py-1 text-xs font-medium text-foreground"
                aria-label={`Remove ${labelFor(id)}`}
              >
                {labelFor(id)} ×
              </button>
            ))}
          </div>
        )}
        <Input
          id="catalog-category-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={categoriesQuery.isLoading ? "Loading categories…" : "Filter categories"}
        />
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pt-1">
          {visibleCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategory(category.id)}
              disabled={value.categories.length >= CATALOG_CATEGORIES_MAX}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
        {categoriesQuery.isError && (
          <p className="text-xs text-destructive">Could not load NEAR Catalog categories.</p>
        )}
        {errorFor("categories") && (
          <p className="text-xs text-destructive">{errorFor("categories")}</p>
        )}
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="catalog-phase">Phase</Label>
        <Select
          value={value.phase || NO_PHASE}
          onValueChange={(phase) =>
            update({ phase: phase === NO_PHASE ? "" : (phase as CatalogPhase) })
          }
        >
          <SelectTrigger id="catalog-phase" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PHASE}>Not set</SelectItem>
            {CATALOG_PHASES.map((phase) => (
              <SelectItem key={phase.value} value={phase.value}>
                {phase.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label>Links</Label>
        <div className="grid grid-cols-1 gap-3">
          {CATALOG_LINKS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`catalog-link-${key}`} className="text-xs text-muted-foreground">
                {label}
              </Label>
              <Input
                id={`catalog-link-${key}`}
                value={value.links[key] ?? ""}
                onChange={(e) => update({ links: { ...value.links, [key]: e.target.value } })}
                placeholder={placeholder}
                className="font-mono text-sm"
                aria-invalid={Boolean(errorFor(key))}
              />
              {errorFor(key) && <p className="text-xs text-destructive">{errorFor(key)}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <Label htmlFor="catalog-token" className="text-xs text-muted-foreground">
            Token contract
          </Label>
          <Input
            id="catalog-token"
            value={value.tokenContract}
            onChange={(e) => update({ tokenContract: e.target.value })}
            placeholder="token.example.near"
            className="font-mono text-sm"
            aria-invalid={Boolean(errorFor("tokenContract"))}
          />
          {errorFor("tokenContract") && (
            <p className="text-xs text-destructive">{errorFor("tokenContract")}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="catalog-coingecko" className="text-xs text-muted-foreground">
            CoinGecko id
          </Label>
          <Input
            id="catalog-coingecko"
            value={value.coingeckoId}
            onChange={(e) => update({ coingeckoId: e.target.value })}
            placeholder="near"
            className="font-mono text-sm"
            aria-invalid={Boolean(errorFor("coingeckoId"))}
          />
          {errorFor("coingeckoId") && (
            <p className="text-xs text-destructive">{errorFor("coingeckoId")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
