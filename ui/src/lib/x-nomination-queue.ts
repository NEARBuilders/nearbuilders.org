import type { ApiClient } from "@/app";

export const X_QUEUE_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending_contact", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
] as const;

export type XNominationFilter = (typeof X_QUEUE_STATUS_FILTERS)[number]["value"];

export type XNominationRecord = Awaited<
  ReturnType<ApiClient["builders"]["listXNominationQueue"]>
>["data"][number];

export type XNominationAction = "mark_contacted" | "reject" | "reopen";

export type XNominationUpdate = {
  row: XNominationRecord;
  action: XNominationAction;
  replyUrl?: string;
};

export type XNominationGroup = {
  nomination: XNominationRecord;
  referrals: XNominationRecord[];
};

export function groupXNominationRecords(rows: XNominationRecord[]): XNominationGroup[] {
  const groups = new Map<string, XNominationGroup>();
  for (const row of rows) {
    const existing = groups.get(row.canonicalNominationId);
    if (!existing) {
      groups.set(row.canonicalNominationId, { nomination: row, referrals: [row] });
      continue;
    }
    existing.referrals.push(row);
    if (row.isCanonical) existing.nomination = row;
  }
  return [...groups.values()];
}

export function filterXNominationGroups(
  groups: XNominationGroup[],
  status: XNominationFilter,
  search: string,
) {
  const normalizedSearch = search.trim().toLowerCase();
  return groups.filter((group) => {
    if (status !== "all" && group.nomination.engagementStatus !== status) return false;
    if (!normalizedSearch) return true;
    return group.referrals.some((row) =>
      [row.nomineeXUsername, row.nominatorXUsername, row.sourcePostText, row.sourcePostId].some(
        (value) => value.toLowerCase().includes(normalizedSearch),
      ),
    );
  });
}

export function xNominationContext(row: XNominationRecord) {
  const withoutCommand = row.sourcePostText.replace(
    /@[A-Za-z0-9_]{1,15}\s+!onboard\s+@[A-Za-z0-9_]{1,15}/i,
    " ",
  );
  const context = withoutCommand
    .replace(/^\s*(?:@[A-Za-z0-9_]{1,15}\s*)+/, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, "")
    .trim();
  return context || null;
}

export function suggestedXReply(row: XNominationRecord) {
  if (!row.joinUrl) return null;
  return `@${row.nomineeXUsername} — the NEAR Builders community nominated you. Create your builder profile here: ${row.joinUrl}`;
}
