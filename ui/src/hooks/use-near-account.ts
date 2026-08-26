import { useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { useAuthClient } from "@/app";
import { nearAccountsQueryOptions } from "@/lib/queries/near-accounts";

export function useNearAccount(enabled = true) {
  const auth = useAuthClient();
  const nearState = auth.$store.atoms.nearState;
  const subscribe = useCallback(
    (onStoreChange: () => void) => nearState.listen(onStoreChange),
    [nearState],
  );
  const getSnapshot = useCallback(() => nearState.get()?.accountId ?? null, [nearState]);
  const connectedAccountId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const linkedAccountQuery = useQuery({
    ...nearAccountsQueryOptions(auth),
    enabled: enabled && !connectedAccountId,
  });

  return {
    accountId: connectedAccountId ?? linkedAccountQuery.data ?? null,
    isLoading: enabled && !connectedAccountId && linkedAccountQuery.isPending,
  };
}

export function useNearAccountId(enabled = true) {
  return useNearAccount(enabled).accountId;
}
