import { keepPreviousData, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const GLOBAL_SEARCH_MIN_CHARS = 2;
export const GLOBAL_SEARCH_GROUP_LIMIT = 5;

export type GlobalSearchGroup = "builders" | "projects" | "events";

export interface GlobalSearchResult {
  /** Stable, group-prefixed id — used for React keys and `aria-activedescendant`. */
  id: string;
  group: GlobalSearchGroup;
  title: string;
  subtitle: string | null;
  /** Route params for the group's detail route (see `selectResult` in global-search.tsx). */
  params: Record<string, string>;
}

export interface GlobalSearchResults {
  builders: GlobalSearchResult[];
  projects: GlobalSearchResult[];
  events: GlobalSearchResult[];
}

export const EMPTY_GLOBAL_SEARCH_RESULTS: GlobalSearchResults = {
  builders: [],
  projects: [],
  events: [],
};

/** Groups render in this order; the flat list used for keyboard nav follows it too. */
export const GLOBAL_SEARCH_GROUP_ORDER: GlobalSearchGroup[] = ["builders", "projects", "events"];

interface BuilderHit {
  id: string;
  nearAccount: string;
  name: string | null;
  bio: string | null;
  skills: string[];
}

interface ProjectHit {
  id: string;
  kind: string;
  slug: string;
  title: string;
  description: string | null;
}

interface EventHit {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  visibility: string;
  status: string;
}

export function toBuilderResult(builder: BuilderHit): GlobalSearchResult {
  const skills = builder.skills.slice(0, 3).join(" · ");
  return {
    id: `builder:${builder.id}`,
    group: "builders",
    title: builder.name?.trim() || builder.nearAccount,
    subtitle: builder.bio?.trim() || skills || builder.nearAccount,
    params: { account: builder.nearAccount },
  };
}

export function toProjectResult(project: ProjectHit): GlobalSearchResult {
  return {
    id: `project:${project.id}`,
    group: "projects",
    title: project.title,
    subtitle: project.description?.trim() || null,
    params: { kind: project.kind, slug: project.slug },
  };
}

export function toEventResult(event: EventHit): GlobalSearchResult {
  const subtitle =
    [formatEventDate(event.startAt), event.location?.trim()].filter(Boolean).join(" · ") || null;
  return {
    id: `event:${event.id}`,
    group: "events",
    title: event.title,
    subtitle,
    params: { slug: event.slug },
  };
}

function formatEventDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The events plugin has no free-text search endpoint yet, so we filter the
 * already-loaded event list client-side — matching how `/events` itself works.
 * Public, non-cancelled events only.
 */
export function filterEvents(
  events: EventHit[],
  term: string,
  limit = GLOBAL_SEARCH_GROUP_LIMIT,
): EventHit[] {
  const needle = term.trim().toLocaleLowerCase();
  if (!needle) return [];
  return events
    .filter((event) => event.visibility === "public" && event.status !== "cancelled")
    .filter((event) =>
      [event.title, event.description, event.location].some((field) =>
        field?.toLocaleLowerCase().includes(needle),
      ),
    )
    .slice(0, limit);
}

export function flattenResults(results: GlobalSearchResults): GlobalSearchResult[] {
  return GLOBAL_SEARCH_GROUP_ORDER.flatMap((group) => results[group]);
}

export function countResults(results: GlobalSearchResults): number {
  return results.builders.length + results.projects.length + results.events.length;
}

/** Events have no search endpoint, so the whole list is fetched once and reused across keystrokes. */
const EVENTS_SNAPSHOT_KEY = ["events", "global-search-snapshot"] as const;

export function globalSearchQueryOptions(
  apiClient: ApiClient,
  queryClient: QueryClient,
  term: string,
  enabled: boolean,
) {
  const trimmed = term.trim();
  return {
    queryKey: ["global-search", trimmed] as const,
    enabled: enabled && trimmed.length >= GLOBAL_SEARCH_MIN_CHARS,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async (): Promise<GlobalSearchResults> => {
      const [builders, projects, events] = await Promise.all([
        apiClient.listBuilders({ search: trimmed, limit: GLOBAL_SEARCH_GROUP_LIMIT }),
        apiClient.listProjects({
          query: trimmed,
          visibility: "public",
          limit: GLOBAL_SEARCH_GROUP_LIMIT,
        }),
        queryClient.ensureQueryData({
          queryKey: EVENTS_SNAPSHOT_KEY,
          queryFn: () => apiClient.listEvents({ limit: 100 }),
          staleTime: 60_000,
        }),
      ]);
      return {
        builders: builders.data.map(toBuilderResult),
        projects: projects.data.map(toProjectResult),
        events: filterEvents(events.data, trimmed).map(toEventResult),
      };
    },
  };
}
