import type { ApiClient } from "@/app";

export type ProposalRecord = Awaited<ReturnType<ApiClient["getProposals"]>>["data"][number];
export type ProposalAuditEntry = Awaited<ReturnType<ApiClient["getAuditLog"]>>["data"][number];
export type ProposalPluginId = "builders" | "projects" | "events" | "nearcatalog";
export type ProposalReviewStatus = ProposalRecord["reviewStatus"];
export type DashboardStatus = "all" | ProposalReviewStatus;

export type ProposalTabSearch = {
  status?: Exclude<DashboardStatus, "all">;
  item?: string;
  q?: string;
};

export const DASHBOARD_STATUSES = ["all", "pending", "approved", "rejected", "removed"] as const;

export function parseProposalTabSearch(search: Record<string, unknown>): ProposalTabSearch {
  const status =
    search.status === "pending" ||
    search.status === "approved" ||
    search.status === "rejected" ||
    search.status === "removed"
      ? search.status
      : undefined;

  return {
    status,
    item: typeof search.item === "string" && search.item.trim() ? search.item : undefined,
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim().slice(0, 200) : undefined,
  };
}

export type AdminTab = "builders" | "projects" | "events" | "activity" | "x-nominations";

export const ADMIN_TABS = [
  {
    value: "builders",
    label: "Builders",
    to: "/admin/dashboard/builders",
    pluginId: "builders" as ProposalPluginId,
    icon: "Hammer" as const,
  },
  {
    value: "projects",
    label: "Projects",
    to: "/admin/dashboard/projects",
    pluginId: "projects" as ProposalPluginId,
    icon: "FolderKanban" as const,
  },
  {
    value: "events",
    label: "Events",
    to: "/admin/dashboard/events",
    pluginId: "events" as ProposalPluginId,
    icon: "CalendarDays" as const,
  },
  {
    value: "activity",
    label: "Activity",
    to: "/admin/dashboard/activity",
    pluginId: "nearcatalog" as ProposalPluginId,
    icon: "Activity" as const,
  },
  {
    value: "x-nominations",
    label: "X Nominations",
    to: "/admin/dashboard/x-nominations",
    pluginId: null,
    icon: "AtSign" as const,
  },
] as const satisfies ReadonlyArray<{
  value: AdminTab;
  label: string;
  to: string;
  pluginId: ProposalPluginId | null;
  icon: string;
}>;

export type AdminTabConfig = (typeof ADMIN_TABS)[number];

export function readPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

export function getProjectKind(value: unknown): "project" | "idea" | "scope" | "result" {
  return value === "idea" || value === "scope" || value === "result" ? value : "project";
}

export function getProposalTitle(proposal: ProposalRecord): string {
  const payload = readPayload(proposal.payload);
  if (proposal.pluginId === "builders") {
    return readString(payload.name) ?? proposal.entityId;
  }
  if (proposal.pluginId === "nearcatalog") {
    return readString(payload.projectName) ?? readString(payload.projectSlug) ?? proposal.entityId;
  }
  return readString(payload.title) ?? proposal.entityId;
}

export function getProposalDescriptor(proposal: ProposalRecord): string {
  const payload = readPayload(proposal.payload);
  if (proposal.pluginId === "builders") {
    return readString(payload.location) ?? readStringArray(payload.skills).slice(0, 2).join(", ");
  }
  if (proposal.pluginId === "projects") {
    const slug = readString(payload.slug);
    return slug ? `/${slug}` : getProjectKind(payload.kind);
  }
  if (proposal.pluginId === "events") {
    return readString(payload.location) ?? readString(payload.slug) ?? "Event proposal";
  }
  return readStringArray(payload.roles).join(", ") || "NearCatalog contribution";
}

export function getProposalTypeLabel(proposal: ProposalRecord): string {
  const payload = readPayload(proposal.payload);
  if (proposal.pluginId === "projects") return getProjectKind(payload.kind);
  if (proposal.pluginId === "nearcatalog") return "NearCatalog";
  if (proposal.pluginId === "events") return "Event";
  return "Builder";
}

export function hasCanonicalPage(proposal: ProposalRecord): boolean {
  return proposal.pluginId !== "nearcatalog";
}

export type ProposalState = {
  label: string;
  tone: "pending" | "approved" | "rejected" | "removed" | "failed";
};

const LIFECYCLE_TIMEOUT_MS = 5 * 60 * 1000;

export function isLifecycleStalled(proposal: ProposalRecord, now = Date.now()): boolean {
  const inProgress = proposal.applyStatus === "applying" || proposal.removeStatus === "removing";
  return inProgress && now - new Date(proposal.updatedAt).getTime() >= LIFECYCLE_TIMEOUT_MS;
}

export function getProposalState(proposal: ProposalRecord, now = Date.now()): ProposalState {
  if (proposal.reviewStatus === "rejected") {
    return { label: "Rejected", tone: "rejected" };
  }
  if (proposal.reviewStatus === "removed") {
    return { label: "Removed", tone: "removed" };
  }
  if (proposal.reviewStatus === "approved" && proposal.removeStatus === "failed") {
    return { label: "Revocation failed", tone: "failed" };
  }
  if (proposal.reviewStatus === "approved" && proposal.applyStatus === "failed") {
    return { label: "Apply failed", tone: "failed" };
  }
  if (proposal.removeStatus === "removing" && isLifecycleStalled(proposal, now)) {
    return { label: "Revocation stalled", tone: "failed" };
  }
  if (proposal.applyStatus === "applying" && isLifecycleStalled(proposal, now)) {
    return { label: "Application stalled", tone: "failed" };
  }
  if (proposal.removeStatus === "removing") {
    return { label: "Revoking", tone: "pending" };
  }
  if (proposal.applyStatus === "applying") {
    return { label: "Applying", tone: "pending" };
  }
  if (proposal.reviewStatus === "approved") {
    return { label: "Approved", tone: "approved" };
  }
  return { label: "Pending", tone: "pending" };
}

export function isSystemAuditEntry(entry: ProposalAuditEntry) {
  const lifecycleActions = ["applied", "apply_failed", "approval_revoked", "remove_failed"];
  return entry.actor === "system" || (!entry.actorLabel && lifecycleActions.includes(entry.action));
}

export function getAuditActor(entry: ProposalAuditEntry) {
  if (isSystemAuditEntry(entry)) return "System";
  return entry.actorLabel ?? entry.actor;
}

export function formatAuditAction(entry: ProposalAuditEntry, pluginId: ProposalPluginId) {
  if (entry.action === "proposed") return "Submitted";
  if (entry.action === "approved") return "Approved";
  if (entry.action === "rejected") return "Rejected";
  if (entry.action === "reopened") return "Reopened";
  if (entry.action === "apply_retried") return "Application retried";
  if (entry.action === "approval_revocation_started") return "Revocation started";
  if (entry.action === "removal_retried") return "Revocation retried";
  if (entry.action === "applied") return pluginId === "nearcatalog" ? "Verified" : "Made public";
  if (entry.action === "approval_revoked") return "Approval revoked";
  if (entry.action === "removed") {
    if (!isSystemAuditEntry(entry)) return "Approval revoked";
    if (pluginId === "builders") return "Removed from directory";
    if (pluginId === "nearcatalog") return "Verification removed";
    return "Made private";
  }
  if (entry.action === "apply_failed") return "Publishing failed";
  if (entry.action === "remove_failed") return "Removal failed";
  return entry.action.replaceAll("_", " ");
}

export function getAuditDetail(entry: ProposalAuditEntry): string | null {
  const details = readPayload(entry.details);
  return (
    readString(details.reason) ??
    readString(details.error) ??
    readString(details.appliedResourceId) ??
    null
  );
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
