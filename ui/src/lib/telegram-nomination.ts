export const NOMINATION_STORAGE_KEY = "near-builders-nomination";

export function initializeNominationToken(
  searchToken: string | undefined,
  storedToken: string | null,
) {
  const capturedToken = searchToken?.trim() || null;
  return {
    token: capturedToken || storedToken?.trim() || null,
    capturedToken,
    shouldCleanUrl: Boolean(capturedToken),
  };
}

export function shouldClearNominationToken(status: string | undefined) {
  return status === "invalid" || status === "submitted";
}
