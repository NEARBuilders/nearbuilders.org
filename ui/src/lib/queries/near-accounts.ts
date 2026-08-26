import type { AuthClient } from "@/app";

export const nearAccountsQueryKey = ["near-accounts"] as const;

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

export function nearAccountsQueryOptions(authClient: AuthClient) {
  return {
    queryKey: nearAccountsQueryKey,
    queryFn: async () => {
      const { data, error } = await authClient.near.listAccounts();
      if (error) throw new Error(error.message || "Failed to load linked NEAR accounts");
      return selectNearAccountId(data);
    },
    staleTime: 60 * 1000,
  };
}
