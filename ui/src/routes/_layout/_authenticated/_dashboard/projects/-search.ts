export type ProjectKindFilter = "all" | "project" | "idea" | "scope" | "result";

export type ProjectListSearch = {
  preview?: string;
  kind?: ProjectKindFilter;
  personal?: boolean;
  private?: boolean;
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

function hasSearchFlag(value: unknown) {
  return value === true || value === "true";
}

export function parseProjectListSearch(search: Record<string, unknown>): ProjectListSearch {
  const personal = hasSearchFlag(search.personal);
  const privateOnly = personal && hasSearchFlag(search.private);

  return {
    preview: typeof search.preview === "string" ? search.preview : undefined,
    kind: isProjectKindFilter(search.kind) ? search.kind : undefined,
    personal: personal || undefined,
    private: privateOnly || undefined,
  };
}
