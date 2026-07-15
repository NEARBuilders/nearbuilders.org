import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { buildProposalApproval, type ProposalApprovalData } from "./proposal-approval";

type ProposalActivityData = ProposalApprovalData &
  Pick<z.infer<typeof ProposalSchema>, "id" | "submissionCount">;

export function createProposalActivity(plugins: Omit<PluginsClient, "auth">) {
  return {
    async emitApproval(proposal: ProposalActivityData, context: Context) {
      const approval = buildProposalApproval(proposal);
      if (!approval) return;

      await plugins.activity(context).emitTrustedActivity({
        source: approval.source,
        type: "approved",
        actor: approval.actor,
        idempotencyKey: `proposal-approved:${proposal.id}:${proposal.submissionCount}`,
        payload: approval.activityPayload,
      });
    },
  };
}
