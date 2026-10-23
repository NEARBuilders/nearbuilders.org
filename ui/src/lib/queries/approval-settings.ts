import type { ApiClient } from "@/app";

type ApprovalSettingsApiClient = Pick<ApiClient, "getApprovalSettings">;

export type ApprovalSettings = Awaited<ReturnType<ApiClient["getApprovalSettings"]>>;

export const approvalSettingsKeys = {
  all: ["approval-settings"] as const,
};

export function requiresAdminApproval(settings: ApprovalSettings | undefined) {
  return settings?.requireAdminApproval !== false;
}

export function approvalSettingsQueryOptions(apiClient: ApprovalSettingsApiClient) {
  return {
    queryKey: approvalSettingsKeys.all,
    queryFn: () => apiClient.getApprovalSettings(),
    staleTime: 5 * 60_000,
  };
}
