import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import { normalizeCatalogClaimRoles } from "../lib/catalog-claims-utils";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { readString, readStringArray, requireObjectPayload } from "../lib/utils";

const CATALOG_CLAIM_PLUGIN_ID = "nearcatalog";

type ProposalRecord = z.infer<typeof ProposalSchema>;

function catalogClaimProposalStatus(
  proposal: Pick<ProposalRecord, "reviewStatus" | "removeStatus">,
): "pending" | "approved" | "rejected" | "revoked" {
  if (proposal.reviewStatus === "removed" || proposal.removeStatus === "removed") return "revoked";
  if (proposal.reviewStatus === "approved") return "approved";
  if (proposal.reviewStatus === "rejected") return "rejected";
  return "pending";
}

function normalizeCatalogClaimProposal(proposal: ProposalRecord) {
  const payload = requireObjectPayload(proposal.payload);
  const projectSlug = readString(payload.projectSlug);
  const roles = normalizeCatalogClaimRoles(readStringArray(payload.roles) ?? []);
  if (!projectSlug || roles.length === 0) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Catalog claim proposal contains invalid data",
    });
  }
  return {
    id: proposal.id,
    projectSlug,
    roles,
    status: catalogClaimProposalStatus(proposal),
    rejectionReason: proposal.rejectionReason,
    submissionCount: proposal.submissionCount,
    revokedAt: proposal.removedAt,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  };
}

export function createCatalogClaims(plugins: Omit<PluginsClient, "auth">) {
  return {
    async submit(
      input: { projectSlug: string; roles: string[]; idempotencyKey: string },
      context: Context,
    ) {
      const builderProfile = await plugins.builders(context).getMyBuilderProfile({});
      if (!builderProfile.data) {
        throw new ORPCError("FORBIDDEN", {
          message: "An approved builder profile is required",
        });
      }

      await plugins.nearcatalog().getCatalogProject({ slug: input.projectSlug });

      const nearAccount = builderProfile.data.nearAccount.trim().toLowerCase();
      const roles = normalizeCatalogClaimRoles(input.roles);
      const proposal = await plugins
        .proposals({
          ...context,
          near: { ...context.near, primaryAccountId: nearAccount },
          allowPrivateSubmission: true,
          resubmissionPolicy: "rejected-or-removed",
        })
        .propose({
          pluginId: CATALOG_CLAIM_PLUGIN_ID,
          entityId: `claim:${nearAccount}:${input.projectSlug}`,
          payload: { nearAccount, projectSlug: input.projectSlug, roles },
          source: "nearcatalog-claim",
          idempotencyKey: input.idempotencyKey,
        });

      return { data: normalizeCatalogClaimProposal(proposal.data) };
    },

    async getMine(context: Context) {
      const builderProfile = await plugins.builders(context).getMyBuilderProfile({});
      if (!builderProfile.data) return { data: [] };

      const nearAccount = builderProfile.data.nearAccount.trim().toLowerCase();
      const proposalsClient = plugins.proposals({
        ...context,
        near: { ...context.near, primaryAccountId: nearAccount },
      });
      const proposals: ProposalRecord[] = [];
      let cursor: string | undefined;
      do {
        const page = await proposalsClient.getProposals({
          pluginId: CATALOG_CLAIM_PLUGIN_ID,
          limit: 100,
          cursor,
        });
        proposals.push(...page.data.filter((proposal) => proposal.createdBy === nearAccount));
        cursor = page.meta.nextCursor ?? undefined;
      } while (cursor);

      return { data: proposals.map(normalizeCatalogClaimProposal) };
    },
  };
}
