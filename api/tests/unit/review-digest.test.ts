import { describe, expect, it, vi } from "vitest";
import {
  buildReviewActivity,
  buildReviewDigest,
  loadReviewDigest,
  reviewDigestDetail,
  reviewDigestState,
  reviewDigestTitle,
} from "../../src/services/review-digest";

const NOW = Date.parse("2026-09-26T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    pluginId: "projects",
    entityId: "project-1",
    operation: "create" as const,
    payload: { title: "Example Project" },
    schemaVersion: "1",
    createdBy: "alice.near",
    reviewStatus: "pending" as const,
    applyStatus: "not_started" as const,
    removeStatus: "not_started" as const,
    rejectionReason: null,
    applyError: null,
    removeError: null,
    appliedResourceId: null,
    submissionCount: 1,
    appliedAt: null,
    removedAt: null,
    createdAt: new Date(NOW - 2 * DAY).toISOString(),
    updatedAt: new Date(NOW - 2 * DAY).toISOString(),
    ...overrides,
  } as Parameters<typeof buildReviewDigest>[0][number];
}

describe("reviewDigestTitle", () => {
  it("uses the same title fields as the admin dashboard", () => {
    expect(reviewDigestTitle(proposal({ pluginId: "builders", payload: { name: "Alice" } }))).toBe(
      "Alice",
    );
    expect(
      reviewDigestTitle(
        proposal({ pluginId: "nearcatalog", payload: { projectSlug: "ref-finance" } }),
      ),
    ).toBe("ref-finance");
    expect(reviewDigestTitle(proposal({ payload: {} }))).toBe("project-1");
  });
});

describe("reviewDigestState", () => {
  it("classifies actionable lifecycle states", () => {
    expect(reviewDigestState(proposal(), NOW)).toBe("pending");
    expect(
      reviewDigestState(proposal({ reviewStatus: "approved", applyStatus: "failed" }), NOW),
    ).toBe("apply_failed");
    expect(
      reviewDigestState(proposal({ reviewStatus: "approved", removeStatus: "failed" }), NOW),
    ).toBe("remove_failed");
    expect(
      reviewDigestState(
        proposal({
          reviewStatus: "approved",
          applyStatus: "applying",
          updatedAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
        }),
        NOW,
      ),
    ).toBe("stalled");
    expect(
      reviewDigestState(
        proposal({
          reviewStatus: "approved",
          applyStatus: "applying",
          updatedAt: new Date(NOW - 60 * 1000).toISOString(),
        }),
        NOW,
      ),
    ).toBeNull();
    expect(
      reviewDigestState(proposal({ reviewStatus: "approved", applyStatus: "applied" }), NOW),
    ).toBeNull();
  });
});

describe("buildReviewDigest", () => {
  it("summarizes pending work oldest first with dashboard links", () => {
    const digest = buildReviewDigest(
      [
        proposal({
          id: "new",
          pluginId: "builders",
          entityId: "alice.near",
          payload: { name: "Alice" },
          createdAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(),
        }),
        proposal({
          id: "stale",
          pluginId: "nearcatalog",
          entityId: "claim:bob.near:ref",
          payload: { projectName: "Ref" },
          createdAt: new Date(NOW - 9 * DAY).toISOString(),
        }),
        proposal({ id: "failed", reviewStatus: "approved", applyStatus: "failed" }),
        proposal({ id: "done", reviewStatus: "approved", applyStatus: "applied" }),
        proposal({ id: "other", pluginId: "votes" }),
      ],
      { now: NOW, staleAfterDays: 7 },
    );

    expect(digest.totals).toEqual({
      pending: 2,
      newLast24h: 1,
      stale: 1,
      needsAttention: 1,
      oldestPendingDays: 9,
    });
    expect(digest.byPlugin).toEqual({ builders: 1, projects: 0, events: 0, nearcatalog: 1 });
    expect(digest.items.map((item) => item.id)).toEqual(["stale", "failed", "new"]);
    expect(digest.items[0]).toMatchObject({
      title: "Ref",
      submittedBy: "alice.near",
      ageDays: 9,
      isStale: true,
      isNew: false,
      dashboardPath: "/admin/dashboard/activity?item=claim%3Abob.near%3Aref&status=pending",
    });
    expect(digest.items[1]).toMatchObject({
      state: "apply_failed",
      isStale: false,
      dashboardPath: "/admin/dashboard/projects?item=project-1",
    });
  });

  it("attaches evaluations only for the current submission", () => {
    const evaluation = {
      proposalId: "current",
      submissionCount: 2,
      verdict: "ready" as const,
      score: 90,
      summary: "Complete profile.",
      flags: [],
    };
    const digest = buildReviewDigest(
      [
        proposal({ id: "current", submissionCount: 2 }),
        proposal({ id: "outdated", entityId: "project-2", submissionCount: 3 }),
        proposal({ id: "missing", entityId: "project-3" }),
      ],
      {
        now: NOW,
        staleAfterDays: 7,
        evaluations: [evaluation, { ...evaluation, proposalId: "outdated", submissionCount: 2 }],
      },
    );
    const byId = Object.fromEntries(digest.items.map((item) => [item.id, item.evaluation]));
    expect(byId).toEqual({
      current: {
        verdict: "ready",
        score: 90,
        summary: "Complete profile.",
        flags: [],
        source: null,
      },
      outdated: null,
      missing: null,
    });
  });

  it("returns an empty digest when nothing is actionable", () => {
    const digest = buildReviewDigest([], { now: NOW, staleAfterDays: 7 });
    expect(digest.totals).toEqual({
      pending: 0,
      newLast24h: 0,
      stale: 0,
      needsAttention: 0,
      oldestPendingDays: null,
    });
    expect(digest.items).toEqual([]);
    expect(digest.activity).toEqual({
      last24h: { approved: 0, rejected: 0 },
      last7d: { reviewed: 0, medianWaitDays: null },
      previous7d: { reviewed: 0, medianWaitDays: null },
    });
  });
});

describe("loadReviewDigest", () => {
  it("pages through actionable proposals", async () => {
    const getProposals = vi
      .fn()
      .mockResolvedValueOnce({
        data: [proposal({ id: "a" })],
        meta: { total: 2, hasMore: true, nextCursor: "100" },
      })
      .mockResolvedValueOnce({
        data: [proposal({ id: "b" })],
        meta: { total: 2, hasMore: false, nextCursor: null },
      });
    const getReviewHistory = vi.fn().mockResolvedValue({
      data: [],
      meta: { total: 0, hasMore: false, nextCursor: null },
    });
    const getEvaluations = vi.fn().mockResolvedValue({ data: [] });
    const plugins = {
      proposals: () => ({ getProposals, getReviewHistory, getEvaluations }),
    } as never;

    const digest = await loadReviewDigest(plugins, { now: NOW, staleAfterDays: 7 });

    expect(getProposals).toHaveBeenNthCalledWith(1, {
      lifecycleStatus: "actionable",
      limit: 100,
      cursor: undefined,
    });
    expect(getProposals).toHaveBeenNthCalledWith(2, {
      lifecycleStatus: "actionable",
      limit: 100,
      cursor: "100",
    });
    expect(digest.totals.pending).toBe(2);
    expect(getReviewHistory).toHaveBeenCalledWith({ limit: 100, cursor: undefined });
  });

  it("stops reading review history once entries are older than two weeks", async () => {
    const getProposals = vi.fn().mockResolvedValue({
      data: [],
      meta: { total: 0, hasMore: false, nextCursor: null },
    });
    const getReviewHistory = vi.fn().mockResolvedValue({
      data: [
        {
          pluginId: "projects",
          action: "approved",
          createdAt: new Date(NOW - 20 * DAY).toISOString(),
          proposal: { createdAt: new Date(NOW - 21 * DAY).toISOString() },
        },
      ],
      meta: { total: 500, hasMore: true, nextCursor: "100" },
    });
    const getEvaluations = vi.fn().mockResolvedValue({ data: [] });
    const plugins = {
      proposals: () => ({ getProposals, getReviewHistory, getEvaluations }),
    } as never;

    await loadReviewDigest(plugins, { now: NOW, staleAfterDays: 7 });

    expect(getReviewHistory).toHaveBeenCalledTimes(1);
  });
});

describe("reviewDigestDetail", () => {
  it("summarizes each queue with one short detail", () => {
    expect(
      reviewDigestDetail(
        proposal({ pluginId: "builders", payload: { skills: ["Rust", "UX", "Go"] } }),
      ),
    ).toBe("Rust, UX");
    expect(
      reviewDigestDetail(proposal({ payload: { repository: "https://github.com/near/intents" } })),
    ).toBe("https://github.com/near/intents");
    expect(reviewDigestDetail(proposal({ pluginId: "events", payload: {} }))).toBeNull();
    expect(
      reviewDigestDetail(proposal({ pluginId: "nearcatalog", payload: { roles: ["Developer"] } })),
    ).toBe("Developer");
  });
});

describe("buildReviewActivity", () => {
  function decision(action: "approved" | "rejected", decidedDaysAgo: number, waitDays: number) {
    return {
      pluginId: "builders",
      action,
      createdAt: new Date(NOW - decidedDaysAgo * DAY).toISOString(),
      proposal: { createdAt: new Date(NOW - (decidedDaysAgo + waitDays) * DAY).toISOString() },
    };
  }

  it("counts yesterday's decisions and compares weekly median waits", () => {
    const activity = buildReviewActivity(
      [
        decision("approved", 0.5, 1),
        decision("rejected", 0.2, 3),
        decision("approved", 3, 2),
        decision("approved", 9, 4),
        decision("approved", 10, 6),
        decision("approved", 20, 1),
        { ...decision("approved", 1, 1), pluginId: "votes" },
      ],
      NOW,
    );

    expect(activity).toEqual({
      last24h: { approved: 1, rejected: 1 },
      last7d: { reviewed: 3, medianWaitDays: 2 },
      previous7d: { reviewed: 2, medianWaitDays: 5 },
    });
  });
});
