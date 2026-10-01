import { describe, expect, it, vi } from "vitest";
import {
  decideTelegramReview,
  TELEGRAM_REJECTION_REASONS,
  telegramReviewerContext,
} from "../../src/services/telegram-review";

const PROPOSAL = {
  id: "proposal_1",
  pluginId: "projects",
  entityId: "project-1",
  payload: { title: "NEAR Rust SDK" },
  submissionCount: 2,
  reviewStatus: "pending",
  updatedAt: "2026-09-26T08:00:00.000Z",
};

function setup(
  options: {
    proposals?: (typeof PROPOSAL)[];
    evaluation?: {
      verdict: string;
      submissionCount: number;
      model?: string | null;
      summary?: string;
    } | null;
  } = {},
) {
  const approve = vi.fn(async () => ({}));
  const reject = vi.fn(async () => ({}));
  const evaluation =
    options.evaluation === undefined
      ? { verdict: "ready", submissionCount: 2, summary: "Official repo, active" }
      : options.evaluation;
  const plugins = {
    proposals: () => ({
      getProposalById: vi.fn(async ({ id }: { id: string }) => ({
        data: (options.proposals ?? [PROPOSAL]).find((proposal) => proposal.id === id) ?? null,
      })),
      getEvaluations: vi.fn(async () => ({
        data: evaluation
          ? [{ proposalId: PROPOSAL.id, model: "claude-opus-5", ...evaluation }]
          : [],
      })),
    }),
  } as never;
  return { approve, reject, plugins };
}

const REVIEWER = { userId: "user-admin", userLabel: "admin.near", telegramUsername: "saad" };
const findReviewer = async (telegramId: number) => (telegramId === 111 ? REVIEWER : null);

const BASE = {
  proposalId: PROPOSAL.id,
  submissionCount: 2,
  actor: { telegramId: 111, username: "saad" },
};

describe("telegramReviewerContext", () => {
  it("acts as the linked admin without the bot's API key", () => {
    const context = telegramReviewerContext(
      {
        apiKey: { id: "bot-key" },
        near: { primaryAccountId: "bot-owner.near" },
        organization: { activeOrganizationId: "org" },
      } as never,
      REVIEWER,
    );
    expect(context).toMatchObject({
      apiKey: undefined,
      near: undefined,
      organization: undefined,
      userId: "user-admin",
      user: { id: "user-admin", name: "admin.near (via Telegram)", role: "admin" },
    });
  });
});

describe("decideTelegramReview", () => {
  it("approves a ready item as the linked admin with the current version", async () => {
    const { approve, reject, plugins } = setup();
    const result = await decideTelegramReview({
      input: { ...BASE, decision: "approve" },
      context: {} as never,
      findReviewer,
      plugins,
      approve,
      reject,
    });

    expect(result).toEqual({
      decision: "approved",
      title: "NEAR Rust SDK",
      verdict: "ready",
      summary: "Official repo, active",
    });
    expect(approve).toHaveBeenCalledWith(
      { pluginId: "projects", entityId: "project-1", expectedUpdatedAt: PROPOSAL.updatedAt },
      expect.objectContaining({ userId: "user-admin" }),
    );
    expect(reject).not.toHaveBeenCalled();
  });

  it("validates without acting in dry-run mode", async () => {
    const { approve, reject, plugins } = setup();
    const result = await decideTelegramReview({
      input: { ...BASE, decision: "reject", dryRun: true },
      context: {} as never,
      findReviewer,
      plugins,
      approve,
      reject,
    });
    expect(result).toEqual({
      decision: "allowed",
      title: "NEAR Rust SDK",
      verdict: "ready",
      summary: "Official repo, active",
    });
    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
    await expect(
      decideTelegramReview({
        input: { ...BASE, decision: "approve", dryRun: true, actor: { telegramId: 999 } },
        context: {} as never,
        findReviewer,
        plugins,
        approve,
        reject,
      }),
    ).rejects.toThrow("Link your Telegram account first");
  });

  it("allows rejecting items that are not marked ready", async () => {
    for (const evaluation of [null, { verdict: "review", submissionCount: 2, model: null }]) {
      const { approve, reject, plugins } = setup({ evaluation });
      await expect(
        decideTelegramReview({
          input: { ...BASE, decision: "reject", reason: "incomplete" },
          context: {} as never,
          findReviewer,
          plugins,
          approve,
          reject,
        }),
      ).resolves.toMatchObject({ decision: "rejected", title: "NEAR Rust SDK" });
      expect(reject).toHaveBeenCalledTimes(1);
    }
  });

  it("approves items that need a look or are not evaluated yet", async () => {
    for (const evaluation of [
      { verdict: "review", submissionCount: 2, summary: "No on-chain account" },
      null,
      { verdict: "spam", submissionCount: 1 },
    ]) {
      const { approve, reject, plugins } = setup({ evaluation });
      await decideTelegramReview({
        input: { ...BASE, decision: "approve" },
        context: {} as never,
        findReviewer,
        plugins,
        approve,
        reject,
      });
      expect(approve).toHaveBeenCalledTimes(1);
    }
  });

  it("reports the verdict and reason in a dry run so the bot can warn", async () => {
    const { approve, reject, plugins } = setup({
      evaluation: { verdict: "review", submissionCount: 2, summary: "No on-chain account" },
    });
    await expect(
      decideTelegramReview({
        input: { ...BASE, decision: "approve", dryRun: true },
        context: {} as never,
        findReviewer,
        plugins,
        approve,
        reject,
      }),
    ).resolves.toEqual({
      decision: "allowed",
      title: "NEAR Rust SDK",
      verdict: "review",
      summary: "No on-chain account",
    });
  });

  it("uses a custom rejection reason verbatim", async () => {
    const { approve, reject, plugins } = setup();
    await decideTelegramReview({
      input: { ...BASE, decision: "reject", customReason: "  Please link your GitHub profile.  " },
      context: {} as never,
      findReviewer,
      plugins,
      approve,
      reject,
    });
    expect(reject).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Please link your GitHub profile." }),
      expect.anything(),
    );
  });

  it("rejects with the preset reason text", async () => {
    const { approve, reject, plugins } = setup();
    await decideTelegramReview({
      input: { ...BASE, decision: "reject", reason: "not_near" },
      context: {} as never,
      findReviewer,
      plugins,
      approve,
      reject,
    });
    expect(reject).toHaveBeenCalledWith(
      expect.objectContaining({ reason: TELEGRAM_REJECTION_REASONS.not_near }),
      expect.anything(),
    );
  });

  it.each([
    ["the Telegram account is not linked", { unlinked: true }, "Link your Telegram account first"],
    ["reject without a reason", { decision: "reject" as const }, "A rejection reason is required"],
    ["item no longer exists", { proposals: [] }, "This item is no longer pending"],
    [
      "item already decided",
      { proposals: [{ ...PROPOSAL, reviewStatus: "approved" }] },
      "This item is no longer pending",
    ],
    ["item resubmitted", { submissionCount: 1 }, "This item was resubmitted since the digest"],
    [
      "approving an item flagged as spam",
      { evaluation: { verdict: "spam", submissionCount: 2 } },
      "Items flagged as likely spam can only be approved from the dashboard",
    ],
  ])("refuses when %s", async (_name, overrides, message) => {
    const { approve, reject, plugins } = setup({
      proposals: (overrides as { proposals?: (typeof PROPOSAL)[] }).proposals,
      evaluation: (
        overrides as {
          evaluation?: {
            verdict: string;
            submissionCount: number;
            model?: string | null;
            summary?: string;
          } | null;
        }
      ).evaluation,
    });
    await expect(
      decideTelegramReview({
        input: {
          ...BASE,
          decision: (overrides as { decision?: "approve" | "reject" }).decision ?? "approve",
          submissionCount: (overrides as { submissionCount?: number }).submissionCount ?? 2,
        },
        context: {} as never,
        findReviewer: (overrides as { unlinked?: boolean }).unlinked
          ? async () => null
          : findReviewer,
        plugins,
        approve,
        reject,
      }),
    ).rejects.toThrow(message);
    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });
});
