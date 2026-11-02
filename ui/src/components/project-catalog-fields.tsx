import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApiClient } from "@/app";
import { Input } from "@/components";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { socialIcon } from "@/components/ui/social-icons";
import {
  CATALOG_CATEGORIES_MAX,
  CATALOG_LINKS,
  CATALOG_PHASES,
  CATALOG_TAGLINE_MAX,
  type CatalogLinkKey,
  type CatalogPhase,
  catalogCategoriesQueryOptions,
  getCatalogReadiness,
  getProjectCatalogErrors,
  hasProjectCatalogValues,
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
  eyebrow,
}: {
  value: ProjectCatalogFormValues;
  onChange: (next: ProjectCatalogFormValues) => void;
  description?: string;
  logoUrl?: string;
  showErrors: boolean;
  eyebrow?: string;
}) {
  const bodyId = useId();
  const errors = getProjectCatalogErrors(value);
  const hasErrors = showErrors && Object.keys(errors).length > 0;
  const [open, setOpen] = useState(() => hasProjectCatalogValues(value));
  const [tokenOpen, setTokenOpen] = useState(() =>
    Boolean(value.tokenContract.trim() || value.coingeckoId.trim()),
  );
  const expanded = open || hasErrors;
  const readiness = getCatalogReadiness({
    description,
    logoUrl,
    catalog: projectCatalogFromFormValues(value),
  });

  const update = (patch: Partial<ProjectCatalogFormValues>) => onChange({ ...value, ...patch });
  const errorFor = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-12 text-brand-accent">{eyebrow}</p>
          )}
          <h2 className="text-base font-semibold text-foreground">NEAR Catalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional. Details for listing this project on NEAR Catalog.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground hover:underline"
        >
          {expanded ? "Hide" : hasProjectCatalogValues(value) ? "Edit" : "Add details"}
          <ChevronDown
            size={14}
            className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded && (
        <div id={bodyId} className="mt-5 space-y-5">
          <p className="text-xs text-muted-foreground">
            {readiness.ready
              ? "Ready for a NEAR Catalog listing."
              : `Needed for a listing: ${readiness.missing
                  .map((item) => item.label.toLowerCase())
                  .join(", ")}.`}
          </p>

          <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="catalog-tagline">Tagline</Label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    value.tagline.trim().length > CATALOG_TAGLINE_MAX
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {value.tagline.trim().length}/{CATALOG_TAGLINE_MAX}
                </span>
              </div>
              <Input
                id="catalog-tagline"
                value={value.tagline}
                onChange={(e) => update({ tagline: e.target.value })}
                placeholder="One line about what it does"
                aria-invalid={Boolean(errorFor("tagline"))}
              />
              {errorFor("tagline") && (
                <p className="text-xs text-destructive">{errorFor("tagline")}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:w-44 sm:shrink-0">
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
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="catalog-categories">Categories</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {value.categories.length}/{CATALOG_CATEGORIES_MAX}
              </span>
            </div>
            <CategoryCombobox
              id="catalog-categories"
              selected={value.categories}
              onChange={(categories) => update({ categories })}
            />
            {errorFor("categories") && (
              <p className="text-xs text-destructive">{errorFor("categories")}</p>
            )}
          </div>

          <SocialLinks
            links={value.links}
            onChange={(links) => update({ links })}
            errorFor={errorFor}
          />

          {tokenOpen || errorFor("tokenContract") || errorFor("coingeckoId") ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Token</span>
                <button
                  type="button"
                  onClick={() => {
                    update({ tokenContract: "", coingeckoId: "" });
                    setTokenOpen(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Remove token
                </button>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-token">Token contract</Label>
                  <Input
                    id="catalog-token"
                    value={value.tokenContract}
                    onChange={(e) => update({ tokenContract: e.target.value })}
                    placeholder="token.example.near"
                    className="text-sm"
                    aria-invalid={Boolean(errorFor("tokenContract"))}
                  />
                  {errorFor("tokenContract") && (
                    <p className="text-xs text-destructive">{errorFor("tokenContract")}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-coingecko">CoinGecko id</Label>
                  <Input
                    id="catalog-coingecko"
                    value={value.coingeckoId}
                    onChange={(e) => update({ coingeckoId: e.target.value })}
                    placeholder="near"
                    className="text-sm"
                    aria-invalid={Boolean(errorFor("coingeckoId"))}
                  />
                  {errorFor("coingeckoId") && (
                    <p className="text-xs text-destructive">{errorFor("coingeckoId")}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTokenOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} />
              Has a token? Add contract and CoinGecko id
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function SocialLinks({
  links,
  onChange,
  errorFor,
}: {
  links: ProjectCatalogFormValues["links"];
  onChange: (next: ProjectCatalogFormValues["links"]) => void;
  errorFor: (key: CatalogLinkKey) => string | undefined;
}) {
  const [enabled, setEnabled] = useState<CatalogLinkKey[]>(() =>
    CATALOG_LINKS.flatMap(({ key }) => (links[key]?.trim() ? [key] : [])),
  );
  const [focusKey, setFocusKey] = useState<CatalogLinkKey | null>(null);

  useEffect(() => {
    if (!focusKey) return;
    document.getElementById(`catalog-link-${focusKey}`)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const toggle = (key: CatalogLinkKey) => {
    if (enabled.includes(key)) {
      setEnabled(enabled.filter((item) => item !== key));
      onChange({ ...links, [key]: "" });
    } else {
      setEnabled([...enabled, key]);
      setFocusKey(key);
    }
  };
  const active = CATALOG_LINKS.filter(({ key }) => enabled.includes(key));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">Socials</span>
          <p className="text-xs text-muted-foreground">Select an icon to add that link.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATALOG_LINKS.map(({ key, label }) => {
            const Icon = socialIcon(key);
            const on = enabled.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                aria-label={label}
                title={label}
                onClick={() => toggle(key)}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-md border transition-colors",
                  on
                    ? "border-brand-accent-border bg-brand-accent-light text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>
      {active.length > 0 && (
        <div className="space-y-2 pt-1">
          {active.map(({ key, label, placeholder }) => {
            const Icon = socialIcon(key);
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id={`catalog-link-${key}`}
                      aria-label={`${label} URL`}
                      value={links[key] ?? ""}
                      onChange={(e) => onChange({ ...links, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="pl-9 text-sm"
                      aria-invalid={Boolean(errorFor(key))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Remove ${label}`}
                  >
                    <X size={14} />
                  </button>
                </div>
                {errorFor(key) && <p className="text-xs text-destructive">{errorFor(key)}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryCombobox({
  id,
  selected,
  onChange,
}: {
  id: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const listId = useId();
  const apiClient = useApiClient();
  const categoriesQuery = useQuery(catalogCategoriesQueryOptions(apiClient));
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const categories = categoriesQuery.data ?? [];
  const atLimit = selected.length >= CATALOG_CATEGORIES_MAX;
  const labelFor = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.label ?? categoryId;
  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories.filter(
      (category) =>
        !selected.includes(category.id) &&
        (!needle || category.label.toLowerCase().includes(needle) || category.id.includes(needle)),
    );
  }, [categories, query, selected]);
  const showList = open && !atLimit;
  const activeOption = showList ? options[activeIndex] : undefined;
  const activeOptionId = activeOption ? `${listId}-${activeOption.id}` : undefined;

  useEffect(() => {
    if (activeOptionId)
      document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const add = (categoryId: string) => {
    if (atLimit || selected.includes(categoryId)) return;
    onChange([...selected, categoryId]);
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  };
  const remove = (categoryId: string) =>
    onChange(selected.filter((category) => category !== categoryId));

  return (
    <div ref={rootRef} className="relative">
      {/* oxlint-disable-next-line shadcn/no-arbitrary-values -- matches the Input focus ring so the chip field reads as one control */}
      <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-input px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
        {selected.map((categoryId) => (
          <Badge key={categoryId} variant="secondary" className="gap-1 py-0.5 pr-1 pl-2">
            {labelFor(categoryId)}
            <button
              type="button"
              onClick={() => remove(categoryId)}
              className="inline-flex size-4 items-center justify-center rounded-full hover:bg-muted-foreground/20"
              aria-label={`Remove ${labelFor(categoryId)}`}
            >
              <X size={11} />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          value={query}
          disabled={atLimit}
          placeholder={
            atLimit
              ? `Up to ${CATALOG_CATEGORIES_MAX} categories`
              : selected.length > 0
                ? "Add another…"
                : "Search categories…"
          }
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              if (showList && activeOption) {
                event.preventDefault();
                add(activeOption.id);
              }
            } else if (event.key === "Escape") {
              setOpen(false);
            } else if (event.key === "Backspace" && !query && selected.length > 0) {
              remove(selected[selected.length - 1]);
            }
          }}
          className="h-7 min-w-32 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>

      {showList && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {categoriesQuery.isLoading ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading categories…</p>
          ) : categoriesQuery.isError ? (
            <p className="px-2 py-1.5 text-sm text-destructive">
              Could not load NEAR Catalog categories.
            </p>
          ) : options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No categories match.</p>
          ) : (
            options.map((category, index) => (
              <button
                key={category.id}
                id={`${listId}-${category.id}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => add(category.id)}
                className={cn(
                  "flex w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
              >
                {category.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
