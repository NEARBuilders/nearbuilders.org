export type ClaimContext = {
  userId?: string | null;
  near?: { primaryAccountId?: string | null } | null;
};

/**
 * Moves rows a caller owns under their auth user id onto their primary NEAR account the first
 * time they act with one linked (#366). Runs once per (user id, account) per process. It is
 * best-effort: a failure is logged and retried on the next request, never failing the caller's
 * real request. The set of claimed keys is cleared when it reaches `max`; a re-claim is
 * idempotent, so that only costs a redundant query.
 */
export function createUserIdRowClaimer<C extends ClaimContext>(
  label: string,
  claim: (context: C, userId: string, ownerId: string) => Promise<void>,
  max = 10_000,
) {
  const claimed = new Set<string>();
  return async (context: C) => {
    const userId = context.userId;
    const ownerId = context.near?.primaryAccountId;
    if (!userId || !ownerId || ownerId === userId) return;
    const key = `${userId}\u0000${ownerId}`;
    if (claimed.has(key)) return;
    try {
      await claim(context, userId, ownerId);
      if (claimed.size >= max) claimed.clear();
      claimed.add(key);
    } catch (error) {
      console.error(
        `[${label}] Could not move user-id rows to the NEAR account; will retry:`,
        error,
      );
    }
  };
}
