export type ProjectKindFilter = "all" | "project" | "idea" | "scope" | "result";

export type ProjectSort = "votes" | "newest" | "oldest";
export type ProjectStatusFilter = "all" | "active" | "paused" | "archived";

export type ProjectListSearch = {
  preview?: string;
  kind?: ProjectKindFilter;
  personal?: boolean;
  private?: boolean;
  verified?: boolean;
  sort?: ProjectSort;
  query?: string;
  status?: ProjectStatusFilter;
};

export function isProjectKind(value: unknown): value is Exclude<ProjectKindFilter, "all"> {
  return value === "project" || value === "idea" || value === "scope" || value === "result";
}

function isProjectKindFilter(value: unknown): value is ProjectKindFilter {
  return (
    value === "all" ||
    value === "project" ||
    value === "idea" ||
    value === "scope" ||
    value === "result"
  );
}

function isProjectSort(value: unknown): value is ProjectSort {
  return value === "votes" || value === "newest" || value === "oldest";
}

function isProjectStatus(value: unknown): value is ProjectStatusFilter {
  return value === "all" || value === "active" || value === "paused" || value === "archived";
}

function hasSearchFlag(value: unknown) {
  return value === true || value === "true";
}

export function parseProjectListSearch(search: Record<string, unknown>): ProjectListSearch {
  const personal = hasSearchFlag(search.personal);
  const verified = hasSearchFlag(search.verified);
  const privateOnly = personal && !verified && hasSearchFlag(search.private);

  return {
    preview: typeof search.preview === "string" ? search.preview : undefined,
    kind: isProjectKindFilter(search.kind) ? search.kind : undefined,
    personal: personal || undefined,
    private: privateOnly || undefined,
    verified: verified || undefined,
    sort: isProjectSort(search.sort) ? search.sort : undefined,
    query:
      typeof search.query === "string" && search.query.trim().length > 0
        ? search.query.trim()
        : undefined,
    status: isProjectStatus(search.status) && search.status !== "all" ? search.status : undefined,
  };
}
