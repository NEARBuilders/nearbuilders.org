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
        collaborations: fulfilled(5),
      }),
    ).toEqual({
      projects: 4,
      ideas: 3,
      feedbackRounds: 8,
      githubIssues: 2,
      collaborations: 5,
    });
  });

  it("falls back to zero when a source is unavailable", () => {
    expect(
      resolveBuilderStats({
        projects: fulfilled(4),
        ideas: { status: "rejected", reason: new Error("unavailable") },
        feedbackRounds: fulfilled(8),
        githubIssues: { status: "rejected", reason: new Error("unavailable") },
        collaborations: fulfilled(5),
      }),
    ).toMatchObject({
      projects: 4,
      ideas: 0,
      feedbackRounds: 8,
      githubIssues: 0,
      collaborations: 5,
    });
  });
});
