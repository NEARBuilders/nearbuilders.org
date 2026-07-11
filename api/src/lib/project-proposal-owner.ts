import { ORPCError } from "every-plugin/orpc";

// NEAR account ids: 2-64 chars of lowercase alphanumeric segments separated by
// . - _ with no leading/trailing/adjacent separators. Opaque auth user ids and
// API key ids (mixed-case nanoids) don't match, so they can't become owners.
const NEAR_ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

function isNearAccountId(value: string): boolean {
  return value.length >= 2 && value.length <= 64 && NEAR_ACCOUNT_RE.test(value);
}

function readOwnerId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "unknown" || !isNearAccountId(trimmed)) return undefined;
  return trimmed;
}

export function resolveProjectProposalOwner(
  payload: Record<string, unknown>,
  createdBy: string,
): string {
  const ownerId = readOwnerId(payload.ownerId) ?? readOwnerId(createdBy);
  if (!ownerId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Project proposal must identify the project owner",
    });
  }
  return ownerId;
}

export function createProjectProposalOwnerContext(
  context: Record<string, unknown>,
  ownerId: string,
): Record<string, unknown> {
  const normalizedOwnerId = readOwnerId(ownerId);
  if (!normalizedOwnerId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Project proposal must identify the project owner",
    });
  }

  return {
    ...context,
    userId: normalizedOwnerId,
    user: {
      id: normalizedOwnerId,
      role: "user",
    },
    near: {
      ...(typeof context.near === "object" && context.near
        ? (context.near as Record<string, unknown>)
        : {}),
      primaryAccountId: normalizedOwnerId,
    },
  };
}

export function assertProjectProposalOwner(actualOwnerId: string, proposalOwnerId: string) {
  const actual = readOwnerId(actualOwnerId);
  const expected = readOwnerId(proposalOwnerId);
  if (!actual || !expected || actual !== expected) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Project owner does not match proposal owner",
    });
  }
}
