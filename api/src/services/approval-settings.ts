import type { Context } from "../lib/context";

export const AUTO_APPROVAL_ACTOR_ID = "system:auto-approval";
export const AUTO_APPROVAL_ACTOR_NAME = "Auto-approved (admin approval off)";

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function parseRequireAdminApproval(value: string | undefined | null): boolean {
  return ENABLED_VALUES.has((value ?? "").trim().toLowerCase());
}

type ProposalModerationState = {
  reviewStatus: "pending" | "approved" | "rejected" | "removed";
  removeStatus: "not_started" | "removing" | "removed" | "failed";
};

export function wasModeratedByAdmin(proposal: ProposalModerationState | undefined): boolean {
  if (!proposal) return false;
  return (
    proposal.reviewStatus === "rejected" ||
    proposal.reviewStatus === "removed" ||
    proposal.removeStatus === "removed"
  );
}

export function shouldAutoApproveBuilderProfile(options: {
  requireAdminApproval: boolean;
  previous: ProposalModerationState | undefined;
  submitted: { reviewStatus: ProposalModerationState["reviewStatus"] };
}): boolean {
  return (
    !options.requireAdminApproval &&
    !wasModeratedByAdmin(options.previous) &&
    options.submitted.reviewStatus === "pending"
  );
}

export function autoApprovalContext(base: Context): Context {
  return {
    ...base,
    apiKey: undefined,
    near: undefined,
    organization: undefined,
    userId: AUTO_APPROVAL_ACTOR_ID,
    user: {
      id: AUTO_APPROVAL_ACTOR_ID,
      name: AUTO_APPROVAL_ACTOR_NAME,
      email: "auto-approval@system.invalid",
      emailVerified: false,
      image: null,
      role: "admin",
      isAnonymous: false,
    },
  } as unknown as Context;
}

type VisibilityValue = "private" | "unlisted" | "public";

export function resolveContentCreationVisibility(options: {
  isAdmin: boolean;
  allowPublic: boolean;
  inputVisibility: VisibilityValue | undefined;
}): VisibilityValue {
  if (!options.isAdmin && !options.allowPublic && options.inputVisibility === "public") {
    return "private";
  }
  return options.inputVisibility ?? "private";
}
