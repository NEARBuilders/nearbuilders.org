import { describe, expect, it } from "vitest";
import { resolveBuilderStats } from "../../src/services/builder-stats";

const fulfilled = (total: number): PromiseSettledResult<{ meta: { total: number } }> => ({
  status: "fulfilled",
  value: { meta: { total } },
});

describe("builder stats", () => {
  it("maps source totals to profile stats", () => {
    expect(
      resolveBuilderStats({
        projects: fulfilled(4),
        ideas: fulfilled(3),
        feedbackRounds: fulfilled(8),
        githubIssues: fulfilled(2),
        catalogProjects: fulfilled(5),
      }),
    ).toEqual({
      projects: 4,
      ideas: 3,
      feedbackRounds: 8,
      githubIssues: 2,
      catalogProjects: 5,
    });
  });

  it("keeps unavailable sources separate from real zero values", () => {
    expect(
      resolveBuilderStats({
        projects: fulfilled(4),
        ideas: { status: "rejected", reason: new Error("unavailable") },
        feedbackRounds: fulfilled(8),
        githubIssues: { status: "rejected", reason: new Error("unavailable") },
        catalogProjects: fulfilled(0),
      }),
    ).toMatchObject({
      projects: 4,
      ideas: null,
      feedbackRounds: 8,
      githubIssues: null,
      catalogProjects: 0,
    });
  });
});
