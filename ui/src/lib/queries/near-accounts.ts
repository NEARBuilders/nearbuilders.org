import type { ListAccountsResponseT } from "better-near-auth";
import type { AuthClient } from "@/app";

export const nearAccountsQueryKey = ["near-accounts"] as const;

export function nearAccountsOptions(authClient: AuthClient) {
  return {
    queryKey: nearAccountsQueryKey,
    queryFn: async (): Promise<ListAccountsResponseT> => {
      const { data, error } = await authClient.near.listAccounts();
      if (error) throw new Error(error.message);
      return data ?? { accounts: [], activeAccount: null, availableAccounts: [] };
    },
    staleTime: 30_000,
  };
}
