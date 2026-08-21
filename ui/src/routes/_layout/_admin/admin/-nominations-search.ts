import type { XNominationFilter } from "@/lib/x-nomination-queue";

type NominationsSearch = {
  status?: XNominationFilter;
  q?: string;
};

const NOMINATION_STATUS_VALUES: ReadonlySet<string> = new Set([
  "all",
  "pending_contact",
  "contacted",
  "rejected",
  "completed",
]);

export function parseNominationsSearch(search: Record<string, unknown>): NominationsSearch {
  return {
    status:
      typeof search.status === "string" && NOMINATION_STATUS_VALUES.has(search.status)
        ? (search.status as XNominationFilter)
        : undefined,
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim().slice(0, 200) : undefined,
  };
}
