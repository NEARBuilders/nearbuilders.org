import type { z } from "every-plugin/zod";
import type { ProposalSchema } from "../../../plugins/proposals/src/contract";
import { readString } from "../lib/utils";

export type ProposalApprovalData = Pick<
  z.infer<typeof ProposalSchema>,
  "pluginId" | "entityId" | "payload" | "createdBy"
>;

type ProposalApprovalDescriptor = {
  actor: string;
  source: "projects" | "events" | "builders";
  notificationType: "project_approved" | "event_approved" | "builder_approved";
  title: string;
  activityPayload: Record<string, unknown>;
  notificationDescription: string;
  link: string;
};

export function buildProposalApproval(
  proposal: ProposalApprovalData,
): ProposalApprovalDescriptor | null {
  const payload =
    proposal.payload && typeof proposal.payload === "object" && !Array.isArray(proposal.payload)
      ? (proposal.payload as Record<string, unknown>)
      : {};

  if (proposal.pluginId === "projects") {
    const slug = readString(payload.slug) ?? proposal.entityId;
    const title = readString(payload.title) ?? "Project";
    const kind =
      payload.kind === "idea" || payload.kind === "scope" || payload.kind === "result"
        ? payload.kind
        : "project";
    return {
      actor: proposal.createdBy,
      source: "projects",
      notificationType: "project_approved",
      title: `${title} approved`,
      activityPayload: {
        projectId: proposal.entityId,
        projectKind: kind,
        projectSlug: slug,
        projectTitle: title,
        projectDescription: readString(payload.description),
        repositoryUrl: readString(payload.repository),
      },
      notificationDescription: "Your project was approved and is now public on NEAR Builders.",
      link: `/projects/${kind}/${slug}`,
    };
  }

  if (proposal.pluginId === "events") {
    const slug = readString(payload.slug) ?? proposal.entityId;
    const title = readString(payload.title) ?? "Event";
    return {
      actor: proposal.createdBy,
      source: "events",
      notificationType: "event_approved",
      title: `${title} approved`,
      activityPayload: {
        title: `${title} approved`,
        description: `${title} is now public on NEAR Builders.`,
      },
      notificationDescription: "Your event was approved and is now public on NEAR Builders.",
      link: `/events/${slug}`,
    };
  }

  if (proposal.pluginId === "builders") {
    const name = readString(payload.name) ?? proposal.entityId;
    return {
      actor: proposal.entityId,
      source: "builders",
      notificationType: "builder_approved",
      title: `${name} approved`,
      activityPayload: {
        title: `${name} approved`,
        description: `${name} is now listed in the NEAR Builders directory.`,
      },
      notificationDescription:
        "Your builder profile was approved and is now public on NEAR Builders.",
      link: `/builders/${proposal.entityId}`,
    };
  }

  return null;
}
