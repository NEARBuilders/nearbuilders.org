import type { BuilderStats } from "../contract";

type PaginatedResult = { meta: { total: number } };

function totalFromResult(result: PromiseSettledResult<PaginatedResult>): number | null {
  return result.status === "fulfilled" ? result.value.meta.total : null;
}

export function resolveBuilderStats(results: {
  projects: PromiseSettledResult<PaginatedResult>;
  ideas: PromiseSettledResult<PaginatedResult>;
  catalogProjects: PromiseSettledResult<PaginatedResult>;
}): BuilderStats {
  return {
    projects: totalFromResult(results.projects),
    ideas: totalFromResult(results.ideas),
    catalogProjects: totalFromResult(results.catalogProjects),
  };
}
