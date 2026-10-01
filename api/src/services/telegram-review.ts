import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { evaluatorContext } from "./review-context";
import { reviewDigestTitle } from "./review-digest";

type ProposalRecord = z.infer<typeof ProposalSchema>;

export const TELEGRAM_REJECTION_REASONS = {
  incomplete: "Incomplete submission. Please add more detail and resubmit.",
  not_near: "This doesn't appear to be related to building on NEAR.",
  spam: "Flagged as spam.",
  duplicate: "Duplicate of an existing listing.",
} as const;

export type TelegramRejectionReason = keyof typeof TELEGRAM_REJECTION_REASONS;

export type TelegramDecisionInput = {
  proposalId: string;
  submissionCount: number;
  decision: "approve" | "reject";
  reason?: TelegramRejectionReason;
  customReason?: string;
  dryRun?: boolean;
  actor: { telegramId: number; username?: string | null };
};

type DecisionAction = (
  input: { pluginId: string; entityId: string; expectedUpdatedAt: string; reason?: string },
  context: Context,
) => Promise<unknown>;

export type LinkedReviewer = {
  userId: string;
  userLabel: string;
  telegramUsername: string | null;
};

export function telegramReviewerContext(base: Context, reviewer: LinkedReviewer): Context {
  return {
    ...base,
    apiKey: undefined,
    near: undefined,
    organization: undefined,
    userId: reviewer.userId,
    user: {
      id: reviewer.userId,
      name: `${reviewer.userLabel} (via Telegram)`,
      email: `${reviewer.userId}@telegram.invalid`,
      emailVerified: false,
      image: null,
      role: "admin",
      isAnonymous: false,
    },
  } as unknown as Context;
}

async function findPendingProposal(
  plugins: Pick<PluginsClient, "proposals">,
  proposalId: string,
): Promise<ProposalRecord | null> {
  const result = await plugins.proposals(evaluatorContext).getProposalById({ id: proposalId });
  return result.data?.reviewStatus === "pending" ? result.data : null;
}

export type TelegramDecisionResult = {
  decision: "approved" | "rejected" | "allowed";
  title: string;
  verdict: "ready" | "review" | "spam" | null;
  summary: string | null;
};

export async function decideTelegramReview(options: {
  input: TelegramDecisionInput;
  context: Context;
  findReviewer: (telegramId: number) => Promise<LinkedReviewer | null>;
  plugins: Pick<PluginsClient, "proposals">;
  approve: DecisionAction;
  reject: DecisionAction;
}): Promise<TelegramDecisionResult> {
  const { input } = options;
  const reviewer = await options.findReviewer(input.actor.telegramId);
  if (!reviewer) {
    throw new ORPCError("FORBIDDEN", {
      message: "Link your Telegram account first: send /link to Chief in a private chat",
    });
  }
  const customReason = input.customReason?.trim();
  if (input.decision === "reject" && !input.reason && !customReason && !input.dryRun) {
    throw new ORPCError("BAD_REQUEST", { message: "A rejection reason is required" });
  }

  const proposal = await findPendingProposal(options.plugins, input.proposalId);
  if (!proposal) {
    throw new ORPCError("NOT_FOUND", { message: "This item is no longer pending" });
  }
  if (proposal.submissionCount !== input.submissionCount) {
    throw new ORPCError("BAD_REQUEST", {
      message: "This item was resubmitted since the digest; review it on the dashboard",
    });
  }
  const evaluations = await options.plugins
    .proposals(evaluatorContext)
    .getEvaluations({ proposalIds: [proposal.id] });
  const stored = evaluations.data.find((entry) => entry.proposalId === proposal.id);
  const evaluation =
    stored && stored.submissionCount === proposal.submissionCount ? stored : undefined;
  if (input.decision === "approve" && evaluation?.verdict === "spam") {
    throw new ORPCError("FORBIDDEN", {
      message: "Items flagged as likely spam can only be approved from the dashboard",
    });
  }

  const details = {
    title: reviewDigestTitle(proposal),
    verdict: evaluation?.verdict ?? null,
    summary: evaluation?.summary ?? null,
  };
  if (input.dryRun) return { decision: "allowed", ...details };

  const context = telegramReviewerContext(options.context, reviewer);
  const target = {
    pluginId: proposal.pluginId,
    entityId: proposal.entityId,
    expectedUpdatedAt: proposal.updatedAt,
  };
  if (input.decision === "approve") {
    await options.approve(target, context);
  } else {
    await options.reject(
      {
        ...target,
        reason: customReason || TELEGRAM_REJECTION_REASONS[input.reason as TelegramRejectionReason],
      },
      context,
    );
  }
  return { decision: input.decision === "approve" ? "approved" : "rejected", ...details };
}
