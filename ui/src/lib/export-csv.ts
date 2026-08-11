import type { ApiClient } from "@/app";
import type { XNominationGroup } from "@/lib/x-nomination-queue";

type ProposalRecord = Awaited<ReturnType<ApiClient["getProposals"]>>["data"][number];
type ProposalPluginId = "builders" | "projects" | "events" | "nearcatalog";
type ProposalReviewStatus = ProposalRecord["reviewStatus"];

export type ProposalExportOptions = {
  pluginId: ProposalPluginId;
  reviewStatus?: ProposalReviewStatus;
  lifecycleStatus?: "actionable";
  query?: string;
  filenameLabel: string;
};

function neutralizeSpreadsheetFormula(value: string): string {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function escapeCsvField(value: string): string {
  const safeValue = neutralizeSpreadsheetFormula(value);
  if (safeValue === "") return "";
  if (/[,"\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

function toCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return escapeCsvField(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return escapeCsvField(value.join(", "));
  return escapeCsvField(JSON.stringify(value));
}

export function serializeCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(toCsvField).join(",")),
  ].join("\r\n");
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const blob = new Blob([`\uFEFF${serializeCsv(headers, rows)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function readPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

const COMMON_HEADERS = [
  "proposalId",
  "entityId",
  "pluginId",
  "createdBy",
  "reviewStatus",
  "applyStatus",
  "removeStatus",
  "rejectionReason",
  "applyError",
  "removeError",
  "appliedResourceId",
  "submissionCount",
  "appliedAt",
  "removedAt",
  "createdAt",
  "updatedAt",
];

const TYPE_HEADERS: Record<ProposalPluginId, string[]> = {
  builders: ["name", "bio", "skills", "location", "links"],
  projects: [
    "title",
    "slug",
    "kind",
    "visibility",
    "description",
    "content",
    "repository",
    "domain",
    "ownerId",
  ],
  events: [
    "title",
    "slug",
    "description",
    "content",
    "startAt",
    "endAt",
    "location",
    "visibility",
    "lumaUrl",
    "ownerId",
  ],
  nearcatalog: ["nearAccount", "projectSlug", "roles"],
};

function getCommonRow(proposal: ProposalRecord): unknown[] {
  return [
    proposal.id,
    proposal.entityId,
    proposal.pluginId,
    proposal.createdBy,
    proposal.reviewStatus,
    proposal.applyStatus,
    proposal.removeStatus,
    proposal.rejectionReason,
    proposal.applyError,
    proposal.removeError,
    proposal.appliedResourceId,
    proposal.submissionCount,
    proposal.appliedAt,
    proposal.removedAt,
    proposal.createdAt,
    proposal.updatedAt,
  ];
}

function getTypeRow(proposal: ProposalRecord, pluginId: ProposalPluginId): unknown[] {
  const payload = readPayload(proposal.payload);
  return TYPE_HEADERS[pluginId].map((header) => payload[header]);
}

export function createProposalCsvData(proposals: ProposalRecord[], pluginId: ProposalPluginId) {
  return {
    headers: [...COMMON_HEADERS, ...TYPE_HEADERS[pluginId]],
    rows: proposals.map((proposal) => [
      ...getCommonRow(proposal),
      ...getTypeRow(proposal, pluginId),
    ]),
  };
}

export async function exportProposalTable(
  apiClient: ApiClient,
  options: ProposalExportOptions,
): Promise<number> {
  const proposals: ProposalRecord[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await apiClient.getProposals({
      pluginId: options.pluginId,
      reviewStatus: options.reviewStatus,
      lifecycleStatus: options.lifecycleStatus,
      query: options.query,
      limit: 100,
      cursor,
    });
    proposals.push(...result.data);
    hasMore = result.meta.hasMore;
    cursor = result.meta.nextCursor ?? undefined;
  }

  const { headers, rows } = createProposalCsvData(proposals, options.pluginId);
  const date = new Date().toISOString().slice(0, 10);
  const status =
    options.lifecycleStatus === "actionable"
      ? "pending"
      : (options.reviewStatus ?? options.lifecycleStatus ?? "all");
  downloadCsv(`admin-${options.filenameLabel}-${status}-${date}.csv`, headers, rows);
  return proposals.length;
}

const X_NOMINATION_HEADERS = [
  "nominationId",
  "nomineeUsername",
  "nomineeXId",
  "nominatorUsername",
  "nominatorXId",
  "referralCount",
  "engagementStatus",
  "sourcePostIds",
  "sourcePostUrls",
  "replyUrl",
  "contactedAt",
  "linkOpenCount",
  "lastOpenedAt",
  "profileStatus",
  "submittedNearAccount",
  "submittedAt",
  "createdAt",
];

export function createXNominationCsvData(groups: XNominationGroup[]) {
  return {
    headers: X_NOMINATION_HEADERS,
    rows: groups.map(({ nomination, referrals }) => [
      nomination.canonicalNominationId,
      nomination.nomineeXUsername,
      nomination.nomineeXId,
      nomination.nominatorXUsername,
      nomination.nominatorXId,
      referrals.length,
      nomination.engagementStatus,
      referrals.map((referral) => referral.sourcePostId),
      referrals.map((referral) => referral.sourcePostUrl),
      nomination.replyUrl,
      nomination.contactedAt,
      nomination.openCount,
      nomination.lastOpenedAt,
      nomination.profileStatus,
      nomination.submittedNearAccount,
      nomination.submittedAt,
      nomination.createdAt,
    ]),
  };
}

export function exportXNominationTable(groups: XNominationGroup[], status: string) {
  const { headers, rows } = createXNominationCsvData(groups);
  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(`admin-x-nominations-${status}-${date}.csv`, headers, rows);
  return groups.length;
}
