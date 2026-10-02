import { describe, expect, it, vi } from "vitest";
import {
  decideTelegramReview,
  TELEGRAM_REJECTION_REASONS,
  type TelegramDecisionInput,
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

const REVIEWER = { userId: "user-admin", userLabel: "admin.near", telegramUsername: "saad" };

type Evaluation = {
  verdict: string;
  submissionCount: number;
  model?: string | null;
  summary?: string;
} | null;

type SetupOptions = { proposals?: (typeof PROPOSAL)[]; evaluation?: Evaluation };

function setup(options: SetupOptions = {}) {
  const approve = vi.fn(async () => ({}));
  const reject = vi.fn(async () => ({}));
  const evaluation =
    options.evaluation === undefined
      ? { verdict: "ready", submissionCount: 2, summary: "Official repo, active" }
      : options.evaluation;
  const plugins = {
    proposals: () => ({
      getTelegramReviewer: vi.fn(async ({ telegramId }: { telegramId: number }) => ({
        data: telegramId === 111 ? REVIEWER : null,
      })),
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
  const decide = (input: Partial<TelegramDecisionInput>) =>
    decideTelegramReview({
      input: { ...BASE, decision: "approve", ...input },
      context: {} as never,
      plugins,
      approve,
      reject,
    });
  return { approve, reject, decide };
}

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
    const { approve, reject, decide } = setup();
    await expect(decide({})).resolves.toEqual({
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

  it("validates without acting in dry-run mode and reports the verdict", async () => {
    const { approve, reject, decide } = setup({
      evaluation: { verdict: "review", submissionCount: 2, summary: "No on-chain account" },
    });
    await expect(decide({ decision: "reject", dryRun: true })).resolves.toEqual({
      decision: "allowed",
      title: "NEAR Rust SDK",
      verdict: "review",
      summary: "No on-chain account",
    });
    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
    await expect(decide({ dryRun: true, actor: { telegramId: 999 } })).rejects.toThrow(
      "Link your Telegram account first",
    );
  });

  it("allows rejecting items that are not marked ready", async () => {
    for (const evaluation of [null, { verdict: "review", submissionCount: 2, model: null }]) {
      const { reject, decide } = setup({ evaluation });
      await expect(decide({ decision: "reject", reason: "incomplete" })).resolves.toMatchObject({
        decision: "rejected",
        title: "NEAR Rust SDK",
      });
      expect(reject).toHaveBeenCalledTimes(1);
    }
  });

  it("approves items that need a look or are not evaluated yet", async () => {
    for (const evaluation of [
      { verdict: "review", submissionCount: 2, summary: "No on-chain account" },
      null,
      { verdict: "spam", submissionCount: 1 },
    ]) {
      const { approve, decide } = setup({ evaluation });
      await decide({});
      expect(approve).toHaveBeenCalledTimes(1);
    }
  });

  it.each([
    [{ customReason: "  Please link your GitHub profile.  " }, "Please link your GitHub profile."],
    [{ reason: "not_near" as const }, TELEGRAM_REJECTION_REASONS.not_near],
  ])("rejects with the given reason text", async (input, reason) => {
    const { reject, decide } = setup();
    await decide({ decision: "reject", ...input });
    expect(reject).toHaveBeenCalledWith(expect.objectContaining({ reason }), expect.anything());
  });

  it.each<[string, SetupOptions, Partial<TelegramDecisionInput>, string]>([
    [
      "the Telegram account is not linked",
      {},
      { actor: { telegramId: 999 } },
      "Link your Telegram account first",
    ],
    ["reject without a reason", {}, { decision: "reject" }, "A rejection reason is required"],
    ["item no longer exists", { proposals: [] }, {}, "This item is no longer pending"],
    [
      "item already decided",
      { proposals: [{ ...PROPOSAL, reviewStatus: "approved" }] },
      {},
      "This item is no longer pending",
    ],
    ["item resubmitted", {}, { submissionCount: 1 }, "This item was resubmitted since the digest"],
    [
      "approving an item flagged as spam",
      { evaluation: { verdict: "spam", submissionCount: 2 } },
      {},
      "Items flagged as likely spam can only be approved from the dashboard",
    ],
  ])("refuses when %s", async (_name, options, input, message) => {
    const { approve, reject, decide } = setup(options);
    await expect(decide(input)).rejects.toThrow(message);
    expect(approve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });
});
