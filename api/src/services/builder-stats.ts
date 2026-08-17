export interface BuilderStats {
  projects: number | null;
  ideas: number | null;
  feedbackRounds: number | null;
  githubIssues: number | null;
  catalogProjects: number | null;
}

type PaginatedResult = { meta: { total: number } };

function totalFromResult(result: PromiseSettledResult<PaginatedResult>): number | null {
  return result.status === "fulfilled" ? result.value.meta.total : null;
}

export function resolveBuilderStats(results: {
  projects: PromiseSettledResult<PaginatedResult>;
  ideas: PromiseSettledResult<PaginatedResult>;
  feedbackRounds: PromiseSettledResult<PaginatedResult>;
  githubIssues: PromiseSettledResult<PaginatedResult>;
  catalogProjects: PromiseSettledResult<PaginatedResult>;
}): BuilderStats {
  return {
    projects: totalFromResult(results.projects),
    ideas: totalFromResult(results.ideas),
    feedbackRounds: totalFromResult(results.feedbackRounds),
    githubIssues: totalFromResult(results.githubIssues),
    catalogProjects: totalFromResult(results.catalogProjects),
  };
}
