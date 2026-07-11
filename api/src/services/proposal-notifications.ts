import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import type { Context } from "../lib/context";
import type { PluginsClient } from "../lib/plugins-types.gen";
import { readString } from "../lib/utils";

type ProposalData = Pick<
  z.infer<typeof ProposalSchema>,
  "pluginId" | "entityId" | "payload" | "appliedResourceId" | "createdBy"
> & {
  rejectionReason?: string | null;
};

type NotificationsClient = ReturnType<PluginsClient["notifications"]>;
export type ProposalNotificationInput = Parameters<NotificationsClient["createNotification"]>[0];
export type ApprovalNotificationInput = ProposalNotificationInput;

export function buildApprovalNotification(
  proposal: ProposalData,
): ProposalNotificationInput | null {
  const payload =
    proposal.payload && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
      ? (proposal.payload as Record<string, unknown>)
      : {};

  if (proposal.pluginId === "projects") {
    const slug = readString(payload.slug) ?? proposal.entityId;
    const title = readString(payload.title) ?? "Project";
    return {
      userId: proposal.createdBy,
      type: "project_approved",
      source: "projects",
      subject: `${title} approved`,
      body: "Your project was approved and is now public on NEAR Builders.",
      link: `/projects/project/${slug}`,
    };
  }

  if (proposal.pluginId === "events") {
    const slug = readString(payload.slug) ?? proposal.entityId;
    const title = readString(payload.title) ?? "Event";
    return {
      userId: proposal.createdBy,
      type: "event_approved",
      source: "events",
      subject: `${title} approved`,
      body: "Your event was approved and is now public on NEAR Builders.",
      link: `/events/${slug}`,
    };
  }

  if (proposal.pluginId === "builders") {
    const account = proposal.entityId;
    const name = readString(payload.name) ?? account;
    return {
      userId: proposal.createdBy,
      type: "builder_approved",
      source: "builders",
      subject: `${name} approved`,
      body: "Your builder profile was approved and is now public on NEAR Builders.",
      link: `/builders/${account}`,
    };
  }

  return null;
}

function buildRejectionBody(body: string, reason?: string) {
  return reason ? `${body} Reason: ${reason}` : body;
}

export function buildRejectionNotification(
  proposal: ProposalData,
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
      body: buildRejectionBody("Your project was not approved by NEAR Builders.", reason),
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
      body: buildRejectionBody("Your event was not approved by NEAR Builders.", reason),
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
      body: buildRejectionBody("Your builder profile was not approved by NEAR Builders.", reason),
      link: "/dashboard",
    };
  }

  return null;
}

function notificationContext(context: Context) {
  return { ...context, userId: context.near?.primaryAccountId ?? undefined };
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
    const notification = buildRejectionNotification(proposal);
    if (!notification) return;
    try {
      await plugins.notifications(notificationContext(context)).createNotification(notification);
    } catch (error) {
      console.error("[reject] failed to emit rejection notification", error);
    }
  }

  return { notifyApproval, notifyRejection };
}
