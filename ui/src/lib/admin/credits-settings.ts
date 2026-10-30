import type { ApiClient } from "@/app";

export type CreditSettings = NonNullable<
  Awaited<ReturnType<ApiClient["credits"]["getCreditSettings"]>>["settings"]
>;
export type CreditSettingsInput = Parameters<ApiClient["credits"]["updateCreditSettings"]>[0];
export type NearAiSessionStatus = Awaited<ReturnType<ApiClient["credits"]["nearAiSessionStatus"]>>;

export const creditSettingsQueryKey = ["admin", "credit-settings"] as const;

export function creditSettingsQueryOptions(apiClient: ApiClient) {
  return {
    queryKey: creditSettingsQueryKey,
    queryFn: () => apiClient.credits.getCreditSettings({}),
    staleTime: 10_000,
  };
}

export const nearAiSessionQueryKey = ["admin", "near-ai-session"] as const;

export function nearAiSessionQueryOptions(apiClient: ApiClient) {
  return {
    queryKey: nearAiSessionQueryKey,
    queryFn: () => apiClient.credits.nearAiSessionStatus({}),
  };
}

export type CreditSettingsDraft = {
  enabled: boolean;
  amountUsd: string;
  claimsCloseAt: string;
  keyExpiresAt: string;
  nearAiWorkspaceId: string;
  nearAiLoginAccountId: string;
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toISOString();
}

export function settingsDraft(settings: CreditSettings | null): CreditSettingsDraft {
  return {
    enabled: settings?.enabled ?? false,
    amountUsd: settings ? String(settings.amountUsd) : "5",
    claimsCloseAt: toDatetimeLocal(settings?.claimsCloseAt ?? null),
    keyExpiresAt: toDatetimeLocal(settings?.keyExpiresAt ?? null),
    nearAiWorkspaceId: settings?.nearAiWorkspaceId ?? "",
    nearAiLoginAccountId: settings?.nearAiLoginAccountId ?? "",
  };
}

export function draftToInput(draft: CreditSettingsDraft): CreditSettingsInput {
  return {
    enabled: draft.enabled,
    amountUsd: Number(draft.amountUsd),
    claimsCloseAt: fromDatetimeLocal(draft.claimsCloseAt),
    keyExpiresAt: fromDatetimeLocal(draft.keyExpiresAt),
    nearAiWorkspaceId: draft.nearAiWorkspaceId.trim(),
    nearAiLoginAccountId: draft.nearAiLoginAccountId.trim(),
  };
}
