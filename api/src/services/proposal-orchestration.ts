import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import { AccountIdSchema } from "near-kit/schemas";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import { applyCatalogClaimApplication } from "../lib/catalog-claim-application";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import {
  assertProjectProposalOwner,
  createProjectProposalOwnerContext,
  resolveProjectProposalOwner,
} from "../lib/project-proposal-owner";
import { readString, readStringArray, requireObjectPayload } from "../lib/utils";

type ProposalData = Pick<
  z.infer<typeof ProposalSchema>,
  "pluginId" | "entityId" | "payload" | "appliedResourceId" | "createdBy"
> & {
  rejectionReason?: string | null;
  submissionCount?: number;
};

type CreateCallback = (
  plugins: Omit<PluginsClient, "auth">,
  proposal: ProposalData,
  context: Context,
) => Promise<string>;

type RemoveCallback = (
  plugins: Omit<PluginsClient, "auth">,
  proposal: ProposalData,
  context: Context,
) => Promise<void>;

const IMPLICIT_ACCOUNT_ID_RE = /^[0-9a-f]{64}$/;
const CATALOG_CLAIM_PLUGIN_ID = "nearcatalog";

function normalizeCatalogClaimRoles(roles: string[]) {
  const normalized = new Map<string, string>();
  for (const role of roles) {
    const value = role.trim();
    const key = value.toLowerCase();
    if (value && !normalized.has(key)) normalized.set(key, value);
  }
  return Array.from(normalized.values());
}

function applyCatalogClaimProposal(
  plugins: Omit<PluginsClient, "auth">,
  proposal: ProposalData,
  context: Context,
) {
  const payload = requireObjectPayload(proposal.payload);
  const nearAccount = readString(payload.nearAccount)?.toLowerCase();
  const projectSlug = readString(payload.projectSlug);
  const roles = normalizeCatalogClaimRoles(readStringArray(payload.roles) ?? []);
  if (!nearAccount || !projectSlug || roles.length === 0) {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid Catalog claim proposal" });
  }
  return applyCatalogClaimApplication({
    plugins,
    context,
    entityId: proposal.entityId,
    createdBy: proposal.createdBy,
    submissionCount: proposal.submissionCount ?? 1,
    nearAccount,
    projectSlug,
    roles,
  });
}

export function assertValidBuilderProposalAccount(input: { pluginId: string; entityId: string }) {
  if (input.pluginId !== "builders") return;

  if (!AccountIdSchema.safeParse(input.entityId).success) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Invalid NEAR account ID",
    });
  }

  if (IMPLICIT_ACCOUNT_ID_RE.test(input.entityId)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Builder nominations require a named NEAR account ID",
    });
  }
}

function isNotFoundError(error: unknown): boolean {
  if (error instanceof ORPCError) return error.code === "NOT_FOUND";
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "NOT_FOUND"
  );
}

const createCallbacks: Record<string, CreateCallback> = {
  builders: async (plugins, proposal, context) => {
    const payload = requireObjectPayload(proposal.payload);
    const result = await plugins.builders(context).createBuilder({
      nearAccount: proposal.entityId,
      userId: readString(payload.userId),
      name: readString(payload.name),
      bio: readString(payload.bio),
      skills: readStringArray(payload.skills),
      location: readString(payload.location),
      links:
        payload.links && typeof payload.links === "object" && !Array.isArray(payload.links)
          ? (payload.links as Record<string, string>)
          : undefined,
    });
    return result.data.nearAccount;
  },
  projects: async (plugins, proposal, context) => {
    const payload = requireObjectPayload(proposal.payload);
    const ownerId = resolveProjectProposalOwner(payload, proposal.createdBy);
    const projectsClient = plugins.projects(context);
    const visibility =
      payload.visibility === "private" || payload.visibility === "unlisted"
        ? payload.visibility
        : "public";

    try {
      const updated = await projectsClient.updateProject({
        id: proposal.entityId,
        visibility,
      });
      assertProjectProposalOwner(updated.ownerId, ownerId);
      return updated.id;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    const proposalOwnerContext = createProjectProposalOwnerContext(context, ownerId);
    const result = await plugins.projects(proposalOwnerContext).createProject({
      id: proposal.entityId,
      kind: payload.kind === "idea" ? "idea" : "project",
      title: readString(payload.title) ?? proposal.entityId,
      slug: readString(payload.slug) ?? proposal.entityId,
      description: readString(payload.description),
      content: readString(payload.content),
      visibility,
      repository: readString(payload.repository),
      organizationId: readString(payload.organizationId),
      domain: readString(payload.domain),
    });
    assertProjectProposalOwner(result.ownerId, ownerId);
    return result.id;
  },
  events: async (plugins, proposal, context) => {
    const payload = requireObjectPayload(proposal.payload);
    const ownerId = readString(payload.ownerId) ?? proposal.createdBy;
    const eventsClient = plugins.events(context);
    const visibility =
      payload.visibility === "private" || payload.visibility === "unlisted"
        ? payload.visibility
        : "public";

    try {
      const updated = await eventsClient.updateEvent({
        id: proposal.entityId,
        visibility,
      });
      if (updated.ownerId !== ownerId) {
        throw new ORPCError("FORBIDDEN", { message: "Event proposal owner mismatch" });
      }
      return updated.id;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    const result = await plugins.events(context).createEvent({
      id: proposal.entityId,
      title: readString(payload.title) ?? proposal.entityId,
      slug: readString(payload.slug) ?? proposal.entityId,
      description: readString(payload.description),
      content: readString(payload.content),
      visibility,
      lumaUrl: readString(payload.lumaUrl),
      startAt: readString(payload.startAt) ?? new Date().toISOString(),
      endAt: readString(payload.endAt),
      location: readString(payload.location),
      ownerId,
    });
    return result.id;
  },
  [CATALOG_CLAIM_PLUGIN_ID]: applyCatalogClaimProposal,
};

const removeCallbacks: Record<string, RemoveCallback> = {
  builders: async (plugins, proposal, context) => {
    await plugins.builders(context).deleteBuilder({
      nearAccount: proposal.entityId,
    });
  },
  projects: async (plugins, proposal, context) => {
    const projectId = proposal.appliedResourceId ?? proposal.entityId;
    try {
      await plugins.projects(context).updateProject({
        id: projectId,
        visibility: "private",
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  },
  events: async (plugins, proposal, context) => {
    const eventId = proposal.appliedResourceId ?? proposal.entityId;
    try {
      await plugins.events(context).updateEvent({
        id: eventId,
        visibility: "private",
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  },
  [CATALOG_CLAIM_PLUGIN_ID]: async (plugins, proposal, context) => {
    const claimId = proposal.appliedResourceId ?? proposal.entityId;
    const revoked = await plugins.nearcatalog(context).revokeCatalogClaim({ id: claimId });
    if (revoked.data.activityEventId) {
      await plugins.activity(context).hideActivity({ id: revoked.data.activityEventId });
    }
  },
};

export function createProposalOrchestration(plugins: Omit<PluginsClient, "auth">) {
  return {
    createCallbacks,
    removeCallbacks,

    async applyProposal(proposal: ProposalData, context: Context): Promise<string> {
      const createCallback = createCallbacks[proposal.pluginId];
      if (!createCallback) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Unsupported pluginId: ${proposal.pluginId}`,
        });
      }
      return await createCallback(plugins, proposal, context);
    },

    async removeProposal(proposal: ProposalData, context: Context): Promise<void> {
      const removeCallback = removeCallbacks[proposal.pluginId];
      if (!removeCallback) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Unsupported pluginId: ${proposal.pluginId}`,
        });
      }
      await removeCallback(plugins, proposal, context);
    },
  };
}
