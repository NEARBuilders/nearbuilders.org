export interface BuilderStats {
  projects: number;
  ideas: number;
  feedbackRounds: number;
  githubIssues: number;
  collaborations: number;
}

type PaginatedResult = { meta: { total: number } };

function totalFromResult(result: PromiseSettledResult<PaginatedResult>): number {
  return result.status === "fulfilled" ? result.value.meta.total : 0;
}

export function resolveBuilderStats(results: {
  projects: PromiseSettledResult<PaginatedResult>;
  ideas: PromiseSettledResult<PaginatedResult>;
  feedbackRounds: PromiseSettledResult<PaginatedResult>;
  githubIssues: PromiseSettledResult<PaginatedResult>;
  collaborations: PromiseSettledResult<PaginatedResult>;
}): BuilderStats {
  return {
    projects: totalFromResult(results.projects),
    ideas: totalFromResult(results.ideas),
    feedbackRounds: totalFromResult(results.feedbackRounds),
    githubIssues: totalFromResult(results.githubIssues),
    collaborations: totalFromResult(results.collaborations),
  };
}
