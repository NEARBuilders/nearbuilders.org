import type { ApiClient } from "@/app";

function escapeCsvField(value: string): string {
  if (value === "") return "";
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return escapeCsvField(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return escapeCsvField(value.join(", "));
  return escapeCsvField(JSON.stringify(value));
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) => row.map(toCsvField).join(",")),
  ].join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface ProposalRecord {
  id: string;
  pluginId: string;
  entityId: string;
  payload: unknown;
  createdBy: string;
  reviewStatus: string;
  rejectionReason: string | null;
  applyStatus: string;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

function readPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const PROJECT_CSV_HEADERS = [
  "entityId",
  "title",
  "slug",
  "kind",
  "visibility",
  "description",
  "repository",
  "domain",
  "createdBy",
  "reviewStatus",
  "rejectionReason",
  "applyStatus",
  "submissionCount",
  "createdAt",
  "updatedAt",
];

export async function exportProjectProposals(apiClient: ApiClient): Promise<number> {
  const proposals: ProposalRecord[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await apiClient.getProposals({
      pluginId: "projects",
      limit: 100,
      cursor,
    });
    proposals.push(...(result.data as ProposalRecord[]));
    hasMore = result.meta.hasMore;
    cursor = result.meta.nextCursor ?? undefined;
  }

  const rows = proposals.map((proposal) => {
    const payload = readPayload(proposal.payload);
    return [
      proposal.entityId,
      readString(payload.title),
      readString(payload.slug),
      readString(payload.kind),
      readString(payload.visibility),
      readString(payload.description),
      readString(payload.repository),
      readString(payload.domain),
      proposal.createdBy,
      proposal.reviewStatus,
      proposal.rejectionReason ?? "",
      proposal.applyStatus,
      String(proposal.submissionCount),
      proposal.createdAt,
      proposal.updatedAt,
    ];
  });

  const date = new Date().toISOString().slice(0, 10);
  downloadCsv(`project-proposals-${date}.csv`, PROJECT_CSV_HEADERS, rows);
  return proposals.length;
}
