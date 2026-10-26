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

export const EMAIL_NOTIFICATION_TYPES = new Set([
  "project_approved",
  "project_rejected",
  "event_approved",
  "event_rejected",
  "builder_approved",
  "builder_rejected",
  "nearcatalog_claim_approved",
  "nearcatalog_claim_rejected",
]);

export type EmailRecipient = {
  email: string | null;
  verified: boolean;
  enabled: boolean;
};

export type DecisionEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export function absoluteNotificationLink(link: string, siteOrigin: string) {
  if (/^https?:\/\//i.test(link)) return link;
  const origin = siteOrigin.replace(/\/$/, "");
  const path = link.startsWith("/") ? link : `/${link}`;
  return `${origin}${path}`;
}

export function decisionEmailText(body: string | undefined, link: string) {
  return [body?.trim(), link].filter((part) => part && part.length > 0).join("\n\n");
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

export function createProposalNotifications(
  plugins: Omit<PluginsClient, "auth">,
  options?: {
    loadRecipient?: (userId: string) => Promise<EmailRecipient | null>;
    sendEmail?: (input: DecisionEmailInput) => Promise<boolean | undefined>;
    siteOrigin?: string;
  },
) {
  async function deliverDecisionEmail(notification: ProposalNotificationInput) {
    if (!options?.sendEmail || !EMAIL_NOTIFICATION_TYPES.has(notification.type)) return;
    try {
      const recipient = options.loadRecipient
        ? await options.loadRecipient(notification.userId)
        : null;
      if (!recipient?.enabled || !recipient.verified || !recipient.email) return;
      const link = absoluteNotificationLink(
        notification.link ?? "",
        options.siteOrigin ?? "https://nearbuilders.org",
      );
      await options.sendEmail({
        to: recipient.email,
        subject: notification.subject,
        text: decisionEmailText(notification.body, link),
      });
    } catch (error) {
      console.error("[email] failed to send decision notification", error);
    }
  }

  async function notifyApproval(proposal: ProposalData, context: Context) {
    const notification = buildApprovalNotification(proposal);
    if (!notification) return;
    try {
      await plugins.notifications(notificationContext(context)).createNotification(notification);
    } catch (error) {
      console.error("[approve] failed to emit approval notification", error);
      return;
    }
    await deliverDecisionEmail(notification);
  }

  async function notifyRejection(proposal: ProposalData, context: Context) {
    const notification = buildRejectionNotification(proposal, reviewerLabel(context));
    if (!notification) return;
    try {
      await plugins.notifications(notificationContext(context)).createNotification(notification);
    } catch (error) {
      console.error("[reject] failed to emit rejection notification", error);
      return;
    }
    await deliverDecisionEmail(notification);
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
