export type BuilderLayout = "grid" | "list";

export function getBuilderCardClassName(
  layout: BuilderLayout,
  isNominated: boolean,
): string {
  return [
    "group relative flex min-h-72 flex-col rounded-xl border bg-secondary p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-accent-border hover:shadow-md",
    layout === "list" ? "sm:min-h-0 sm:flex-row sm:items-center sm:gap-4 sm:p-4" : "",
    isNominated ? "border border-dashed border-border" : "border border-border",
  ]
    .filter(Boolean)
    .join(" ");
}
