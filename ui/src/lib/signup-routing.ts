export const OWN_PROFILE_NOMINATION_ERROR =
  "Use the builder profile endpoint to submit your own profile";

export function normalizeNearAccount(account: string | null | undefined) {
  return account?.trim().toLowerCase() ?? "";
}

export function isSelfJoinIntent(intent: string | null | undefined) {
  return intent === "self";
}

export function isOwnNearAccount(
  account: string | null | undefined,
  ownAccountIds: readonly (string | null | undefined)[],
) {
  const normalizedAccount = normalizeNearAccount(account);
  return (
    normalizedAccount !== "" &&
    ownAccountIds.some((ownAccountId) => normalizeNearAccount(ownAccountId) === normalizedAccount)
  );
}

export function isOwnProfileNominationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "BAD_REQUEST" &&
    "message" in error &&
    error.message === OWN_PROFILE_NOMINATION_ERROR
  );
}
