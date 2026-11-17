import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { viewerOwnerIds } from "@/lib/ownership";
import { linkedNearAccountIdsQueryOptions } from "@/lib/queries/near-accounts";

/**
 * The signed-in viewer's ids, including every linked NEAR account, for ownership checks.
 * `isLoading` is true while the linked accounts are still loading, so callers can avoid
 * showing a "no permission" state to an owner whose project sits on a non-primary account.
 */
export function useViewerOwnerIds() {
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const user = session?.user as
    | { id?: string | null; walletAddress?: string | null; isAnonymous?: boolean | null }
    | undefined;
  const signedIn = Boolean(user && !user.isAnonymous);
  const linkedQuery = useQuery({
    ...linkedNearAccountIdsQueryOptions(auth),
    // Scope the cache to the signed-in user so a new session never sees the previous one's ids.
    queryKey: [...linkedNearAccountIdsQueryOptions(auth).queryKey, user?.id ?? null],
    enabled: signedIn,
  });
  const nearAccountId = auth.near.getAccountId();
  const userId = user?.id;
  const walletAddress = user?.walletAddress;
  const linkedAccountIds = linkedQuery.data;
  const ids = useMemo(
    () => viewerOwnerIds({ id: userId, walletAddress }, nearAccountId, linkedAccountIds ?? []),
    [userId, walletAddress, nearAccountId, linkedAccountIds],
  );
  return { ids, isLoading: signedIn && linkedQuery.isPending };
}
