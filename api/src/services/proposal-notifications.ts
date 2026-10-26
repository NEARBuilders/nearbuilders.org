import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { readString } from "../lib/utils";
import { buildProposalApproval } from "./proposal-approval";

type ProposalData = Pick<
  z.infer<typeof ProposalSchema>,
  "pluginId" | "entityId" | "payload" | "appliedResourceId" | "createdBy"
> & {
  rejectionReason?: string | null;
};

type NotificationsClient = ReturnType<PluginsClient["notifications"]>;
export type ProposalNotificationInput = Parameters<NotificationsClient["createNotification"]>[0];
export type ApprovalNotificationInput = ProposalNotificationInput;
const CATALOG_CLAIM_PLUGIN_ID = "nearcatalog";
const CATALOG_LISTING_PLUGIN_ID = "nearcatalog-listing";

function catalogListingTarget(payload: unknown) {
  const data =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  return {
    title: readString(data.title) ?? (data.kind === "person" ? "Your profile" : "Your project"),
    link: readString(data.link) ?? "/dashboard",
  };
}

export function buildApprovalNotification(
  proposal: ProposalData,
): ProposalNotificationInput | null {
  const approval = buildProposalApproval(proposal);
  if (approval)
    return {
      userId: proposal.createdBy,
      type: approval.notificationType,
      source: approval.source,
      subject: approval.title,
      body: approval.notificationDescription,
      link: approval.link,
    };

  if (proposal.pluginId === CATALOG_CLAIM_PLUGIN_ID) {
    return {
      userId: proposal.createdBy,
      type: "nearcatalog_claim_approved",
      source: CATALOG_CLAIM_PLUGIN_ID,
      subject: "Project contribution approved",
      body: "Your NEAR Catalog contribution is now verified and visible.",
      link: `/builders/${proposal.createdBy}`,
    };
  }

  if (proposal.pluginId === CATALOG_LISTING_PLUGIN_ID) {
    const target = catalogListingTarget(proposal.payload);
    return {
      userId: proposal.createdBy,
      type: "nearcatalog_listing_approved",
      source: CATALOG_LISTING_PLUGIN_ID,
      subject: `${target.title} approved for NEAR Catalog`,
      body: "A NEAR Builders admin approved this listing for NEAR Catalog.",
      link: target.link,
    };
  }

  return null;
}

function buildDecisionBody(body: string, action: string, reviewer?: string, reason?: string) {
  return [body, reviewer ? `${action} by ${reviewer}.` : null, reason ? `Reason: ${reason}` : null]
    .filter(Boolean)
    .join(" ");
}

export function buildRejectionNotification(
  proposal: ProposalData,
  reviewer?: string,
): ProposalNotificationInput | null {
  const payload =
    proposal.payload && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
      ? (proposal.payload as Record<string, unknown>)
      : {};
  const reason = readString(proposal.rejectionReason);

  if (proposal.pluginId === "projects") {
    const title = readString(payload.title) ?? "Project";
    return {
      userId: proposal.createdBy,
      type: "project_rejected",
      source: "projects",
      subject: `${title} rejected`,
      body: buildDecisionBody(
        "Your project was not approved by NEAR Builders.",
        "Rejected",
        reviewer,
        reason,
      ),
      link: "/dashboard",
    };
  }

  if (proposal.pluginId === "events") {
    const title = readString(payload.title) ?? "Event";
    return {
      userId: proposal.createdBy,
      type: "event_rejected",
      source: "events",
      subject: `${title} rejected`,
      body: buildDecisionBody(
        "Your event was not approved by NEAR Builders.",
        "Rejected",
        reviewer,
        reason,
      ),
      link: "/dashboard",
    };
  }

  if (proposal.pluginId === "builders") {
    const account = proposal.entityId;
    const name = readString(payload.name) ?? account;
    return {
      userId: proposal.createdBy,
      type: "builder_rejected",
      source: "builders",
      subject: `${name} rejected`,
      body: buildDecisionBody(
        "Your builder profile was not approved by NEAR Builders.",
        "Rejected",
        reviewer,
        reason,
      ),
      link: "/dashboard",
    };
  }

  if (proposal.pluginId === CATALOG_CLAIM_PLUGIN_ID) {
    return {
      userId: proposal.createdBy,
      type: "nearcatalog_claim_rejected",
      source: CATALOG_CLAIM_PLUGIN_ID,
      subject: "Project contribution needs changes",
      body: buildDecisionBody(
        "Your NEAR Catalog contribution was not approved.",
        "Rejected",
        reviewer,
        reason,
      ),
      link: "/profile/activity?mode=claim",
    };
  }

  if (proposal.pluginId === CATALOG_LISTING_PLUGIN_ID) {
    const target = catalogListingTarget(proposal.payload);
    return {
      userId: proposal.createdBy,
      type: "nearcatalog_listing_rejected",
      source: CATALOG_LISTING_PLUGIN_ID,
      subject: `${target.title} needs changes for NEAR Catalog`,
      body: buildDecisionBody(
        "Your NEAR Catalog listing was not approved.",
        "Rejected",
        reviewer,
        reason,
      ),
      link: target.link,
    };
  }

  return null;
}

export function buildRevocationNotification(
  proposal: ProposalData,
  reviewer?: string,
): ProposalNotificationInput | null {
  const payload =
    proposal.payload && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
      ? (proposal.payload as Record<string, unknown>)
      : {};

  if (proposal.pluginId === "projects") {
    const title = readString(payload.title) ?? "Project";
    return {
      userId: proposal.createdBy,
      type: "project_approval_revoked",
      source: "projects",
      subject: `${title} approval revoked`,
      body: buildDecisionBody("Your project is now private.", "Revoked", reviewer),
      link: "/dashboard",
    };
  }

  if (proposal.pluginId === "events") {
    const title = readString(payload.title) ?? "Event";
    return {
      userId: proposal.createdBy,
      type: "event_approval_revoked",
      source: "events",
      subject: `${title} approval revoked`,
      body: buildDecisionBody("Your event is now private.", "Revoked", reviewer),
      link: "/dashboard",
    };
  }

  if (proposal.pluginId === "builders") {
    const name = readString(payload.name) ?? proposal.entityId;
    return {
      userId: proposal.createdBy,
      type: "builder_approval_revoked",
      source: "builders",
      subject: `${name} approval revoked`,
      body: buildDecisionBody(
        "Your builder profile is no longer public on NEAR Builders.",
        "Revoked",
        reviewer,
      ),
      link: "/dashboard",
    };
  }

  if (proposal.pluginId === CATALOG_CLAIM_PLUGIN_ID) {
    return {
      userId: proposal.createdBy,
      type: "nearcatalog_claim_revoked",
      source: CATALOG_CLAIM_PLUGIN_ID,
      subject: "Project contribution approval revoked",
      body: buildDecisionBody(
        "Your NEAR Catalog contribution is no longer verified.",
        "Revoked",
        reviewer,
      ),
      link: "/profile/activity?mode=claim",
    };
  }

  if (proposal.pluginId === CATALOG_LISTING_PLUGIN_ID) {
    const target = catalogListingTarget(proposal.payload);
    return {
      userId: proposal.createdBy,
      type: "nearcatalog_listing_revoked",
      source: CATALOG_LISTING_PLUGIN_ID,
      subject: `${target.title} removed from NEAR Catalog`,
      body: buildDecisionBody(
        "Your NEAR Catalog listing approval was revoked.",
        "Revoked",
        reviewer,
      ),
      link: target.link,
    };
  }

  return null;
}

function notificationContext(context: Context) {
  return {
    ...context,
    userId: context.near?.primaryAccountId ?? context.userId ?? context.user?.id,
  };
}

function reviewerLabel(context: Context) {
  return (
    context.near?.primaryAccountId ??
    context.user?.name ??
    context.user?.email ??
    context.userId ??
    undefined
  );
}

export function createProposalNotifications(plugins: Omit<PluginsClient, "auth">) {
  async function notifyApproval(proposal: ProposalData, context: Context) {
    const notification = buildApprovalNotification(proposal);
    if (!notification) return;
    try {
      await plugins.notifications(notificationContext(context)).createNotification(notification);
    } catch (error) {
      console.error("[approve] failed to emit approval notification", error);
    }
  }

  async function notifyRejection(proposal: ProposalData, context: Context) {
    const notification = buildRejectionNotification(proposal, reviewerLabel(context));
    if (!notification) return;
    try {
      await plugins.notifications(notificationContext(context)).createNotification(notification);
    } catch (error) {
      console.error("[reject] failed to emit rejection notification", error);
    }
  }

  async function notifyRevocation(proposal: ProposalData, context: Context) {
    const notification = buildRevocationNotification(proposal, reviewerLabel(context));
    if (!notification) return;
    try {
      await plugins.notifications(notificationContext(context)).createNotification(notification);
    } catch (error) {
      console.error("[revoke] failed to emit revocation notification", error);
    }
  }

  return { notifyApproval, notifyRejection, notifyRevocation };
}
