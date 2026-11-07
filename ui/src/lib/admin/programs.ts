import type { ApiClient } from "@/app";
import type { BuildTopicId } from "@/lib/build-content";
import { formatUsd } from "./credit-claims";
import { type CreditSettings, fromDatetimeLocal, toDatetimeLocal } from "./credits-settings";

export type AdminProgram = Awaited<
  ReturnType<ApiClient["projects"]["adminListPrograms"]>
>["data"][number];
export type ProgramStatus = AdminProgram["status"];
export type ProgramCreateInput = Parameters<ApiClient["projects"]["createProgram"]>[0];
export type ProgramUpdateInput = Parameters<ApiClient["projects"]["updateProgram"]>[0];

export const adminProgramsQueryKey = ["admin", "programs"] as const;

export function adminProgramsQueryOptions(apiClient: ApiClient) {
  return {
    queryKey: adminProgramsQueryKey,
    queryFn: async () => (await apiClient.projects.adminListPrograms({})).data,
    staleTime: 10_000,
  };
}

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "Draft",
  listed: "Listed",
  paused: "Paused",
  archived: "Archived",
};

export const PROGRAM_STATUS_ACTIONS: Record<
  ProgramStatus,
  ReadonlyArray<{ status: ProgramStatus; label: string }>
> = {
  draft: [
    { status: "listed", label: "List" },
    { status: "archived", label: "Archive" },
  ],
  listed: [
    { status: "paused", label: "Pause" },
    { status: "archived", label: "Archive" },
  ],
  paused: [
    { status: "listed", label: "List" },
    { status: "archived", label: "Archive" },
  ],
  archived: [{ status: "draft", label: "Restore as draft" }],
};

export type ProgramDraft = {
  projectId: string;
  projectTitle: string;
  type: AdminProgram["type"];
  title: string;
  summary: string;
  rewards: string;
  eligibility: string;
  ctaLabel: string;
  ctaUrl: string;
  topicId: BuildTopicId | "";
  opensAt: string;
  closesAt: string;
  status: ProgramStatus;
};

export function emptyProgramDraft(): ProgramDraft {
  return {
    projectId: "",
    projectTitle: "",
    type: "grant",
    title: "",
    summary: "",
    rewards: "",
    eligibility: "",
    ctaLabel: "",
    ctaUrl: "",
    topicId: "",
    opensAt: "",
    closesAt: "",
    status: "draft",
  };
}

export function programToDraft(program: AdminProgram): ProgramDraft {
  return {
    projectId: program.projectId,
    projectTitle: program.project.title,
    type: program.type,
    title: program.title,
    summary: program.summary ?? "",
    rewards: program.rewards ?? "",
    eligibility: program.eligibility ?? "",
    ctaLabel: program.ctaLabel,
    ctaUrl: program.ctaUrl,
    topicId: program.topicId ?? "",
    opensAt: toDatetimeLocal(program.opensAt),
    closesAt: toDatetimeLocal(program.closesAt),
    status: program.status,
  };
}

export function nearAiCreditsDraft(
  settings: CreditSettings | null,
  base: ProgramDraft = emptyProgramDraft(),
): ProgramDraft {
  return {
    ...base,
    type: "credits",
    title: "NEAR AI Cloud credits",
    summary: "Run private inference on NEAR AI Cloud while you build.",
    rewards: settings ? `${formatUsd(settings.amountUsd)} in NEAR AI Cloud credits` : "",
    eligibility: "Approved NEAR Builders",
    ctaLabel: "Claim credits",
    ctaUrl: "/dashboard",
    topicId: "private-cloud",
    closesAt: toDatetimeLocal(settings?.claimsCloseAt ?? null),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function draftFields(draft: ProgramDraft) {
  return {
    type: draft.type,
    title: draft.title.trim(),
    summary: optionalText(draft.summary),
    rewards: optionalText(draft.rewards),
    eligibility: optionalText(draft.eligibility),
    ctaLabel: draft.ctaLabel.trim(),
    ctaUrl: draft.ctaUrl.trim(),
    topicId: draft.topicId || null,
    opensAt: fromDatetimeLocal(draft.opensAt),
    closesAt: fromDatetimeLocal(draft.closesAt),
    status: draft.status,
  };
}

export function draftToCreateInput(draft: ProgramDraft): ProgramCreateInput {
  return { projectId: draft.projectId, ...draftFields(draft) };
}

export function draftToUpdateInput(id: string, draft: ProgramDraft): ProgramUpdateInput {
  return { id, ...draftFields(draft) };
}

export function moveProgramId(ids: readonly string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
