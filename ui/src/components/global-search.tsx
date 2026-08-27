import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApiClient } from "@/app";
import {
  EMPTY_GLOBAL_SEARCH_RESULTS,
  flattenResults,
  GLOBAL_SEARCH_GROUP_ORDER,
  GLOBAL_SEARCH_MIN_CHARS,
  type GlobalSearchGroup,
  type GlobalSearchResult,
  globalSearchQueryOptions,
} from "@/lib/queries/search";
import { cn } from "@/lib/utils";

const GROUP_LABELS: Record<GlobalSearchGroup, string> = {
  builders: "Builders",
  projects: "Projects",
  events: "Events",
};

const DEBOUNCE_MS = 200;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const [term, setTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const debouncedTerm = useDebouncedValue(term, DEBOUNCE_MS);

  // ⌘K / Ctrl-K toggles the palette from anywhere on the site.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  // Reset transient state whenever the palette closes.
  useEffect(() => {
    if (!open) {
      setTerm("");
      setActiveIndex(0);
    }
  }, [open]);

  const { data, isFetching } = useQuery(
    globalSearchQueryOptions(apiClient, queryClient, debouncedTerm, open),
  );
  const results = data ?? EMPTY_GLOBAL_SEARCH_RESULTS;
  const flat = useMemo(() => flattenResults(results), [results]);

  const groups = useMemo(() => {
    let startIndex = 0;
    return GLOBAL_SEARCH_GROUP_ORDER.map((group) => {
      const entry = { group, results: results[group], startIndex };
      startIndex += results[group].length;
      return entry;
    }).filter((entry) => entry.results.length > 0);
  }, [results]);

  // Keep the highlighted row in range as results change, and scroll it into view.
  useEffect(() => {
    setActiveIndex((index) => (flat.length === 0 ? 0 : Math.min(index, flat.length - 1)));
  }, [flat.length]);
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const trimmed = debouncedTerm.trim();
  const tooShort = trimmed.length < GLOBAL_SEARCH_MIN_CHARS;
  const isLoading = !tooShort && isFetching && flat.length === 0;
  const isEmpty = !tooShort && !isFetching && flat.length === 0;
  const activeResult = flat[activeIndex];

  function selectResult(result: GlobalSearchResult) {
    onOpenChange(false);
    if (result.group === "builders") {
      void navigate({ to: "/builders/$account", params: { account: result.params.account } });
    } else if (result.group === "projects") {
      void navigate({
        to: "/projects/$kind/$slug",
        params: { kind: result.params.kind, slug: result.params.slug },
      });
    } else {
      void navigate({ to: "/events/$slug", params: { slug: result.params.slug } });
    }
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(flat.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      selectResult(activeResult);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label="Site search"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">Search NEAR Builders</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search across builders, projects, and events.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search size={16} className="shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Search builders, projects, events…"
              aria-label="Search query"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={listId}
              aria-activedescendant={activeResult ? `${listId}-${activeResult.id}` : undefined}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {isFetching && !tooShort ? (
              <Loader2 size={14} className="shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
                esc
              </kbd>
            )}
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label="Search results"
            className="max-h-[60vh] overflow-y-auto p-2"
          >
            {tooShort ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Type at least {GLOBAL_SEARCH_MIN_CHARS} characters to search.
              </p>
            ) : isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : isEmpty ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results for “{trimmed}”.
              </p>
            ) : (
              groups.map(({ group, results: groupResults, startIndex }) => (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-accent">
                    {GROUP_LABELS[group]}
                  </p>
                  {groupResults.map((result, offset) => {
                    const index = startIndex + offset;
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={result.id}
                        id={`${listId}-${result.id}`}
                        ref={isActive ? activeItemRef : undefined}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => selectResult(result)}
                        onMouseMove={() => setActiveIndex(index)}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
                          isActive ? "bg-muted" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="truncate text-sm font-medium text-foreground">
                          {result.title}
                        </span>
                        {result.subtitle ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {result.subtitle}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
