import type { AuthClient } from "@/app";

export const nearAccountsQueryKey = ["near-accounts"] as const;
export const linkedNearAccountIdsQueryKey = [...nearAccountsQueryKey, "linked"] as const;

type NearAccount = {
  accountId: string;
  isActive?: boolean;
  isPrimary?: boolean;
};

type NearAccountsData = {
  accounts?: NearAccount[];
  activeAccount?: NearAccount | null;
};

export function selectNearAccountId(data?: NearAccountsData | null) {
  return (
    data?.activeAccount?.accountId ??
    data?.accounts?.find((account) => account.isPrimary || account.isActive)?.accountId ??
    data?.accounts?.[0]?.accountId ??
    null
  );
}

export function selectNearAccountIds(data?: NearAccountsData | null) {
  const accountIds = [
    data?.activeAccount?.accountId,
    ...(data?.accounts ?? []).map((account) => account.accountId),
  ];
  return [...new Set(accountIds.filter((accountId): accountId is string => Boolean(accountId)))];
}

async function listNearAccounts(authClient: AuthClient) {
  const { data, error } = await authClient.near.listAccounts();
  if (error) throw new Error(error.message || "Failed to load linked NEAR accounts");
  return data;
}

export function nearAccountsQueryOptions(authClient: AuthClient) {
  return {
    queryKey: nearAccountsQueryKey,
    queryFn: async () => selectNearAccountId(await listNearAccounts(authClient)),
    staleTime: 60 * 1000,
  };
}

export function linkedNearAccountIdsQueryOptions(authClient: AuthClient) {
  return {
    queryKey: linkedNearAccountIdsQueryKey,
    queryFn: async () => selectNearAccountIds(await listNearAccounts(authClient)),
    staleTime: 60 * 1000,
  };
}
