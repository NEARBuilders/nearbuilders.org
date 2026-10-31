import type { NearAiRefreshTokenStore } from "./nearai-keys";
import { NearAiRequestError, PLUGIN_USER_AGENT, requestError } from "./nearai-keys";

export type NearAiUsageTotals = {
  usedNanoUsd: number;
  requestCount: number;
};

export type NearAiOrganizationUsage = {
  totals: NearAiUsageTotals;
  usedNanoUsdByKeyId: Map<string, number>;
};

export type NearAiReportingProvision = {
  orgId: string;
  reportingToken: string;
};

export type NearAiReportingCredentials = {
  orgId: string | null;
  reportingToken: string | null;
};

export type NearAiReportingClient = {
  provision(): Promise<NearAiReportingProvision | null>;
  getKeyUsage(input: { apiKeyId: string; startTime: Date }): Promise<NearAiUsageTotals | null>;
  getOrganizationUsage(): Promise<NearAiOrganizationUsage | null>;
};

type AccessTokenResponse = {
  access_token: string;
  refresh_token?: string | null;
};

type UsageSummaryResponse = {
  totals?: {
    request_count?: number;
    total_cost_nano_usd?: number;
  } | null;
  by_api_key?: Array<{
    api_key_id?: string | null;
    total_cost_nano_usd?: number | null;
  }> | null;
};

type MeResponse = {
  organization_id?: string | null;
  org_id?: string | null;
  organization?: { id?: string | null } | null;
  organizations?: Array<{ id?: string | null }> | null;
};

const USAGE_CACHE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

function orgCandidatesFromToken(token: string): string[] {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    const candidates: string[] = [];
    for (const key of ["organization_id", "org_id", "orgID", "organizationId"]) {
      if (typeof payload[key] === "string") candidates.push(payload[key]);
    }
    if (typeof payload.organization?.id === "string") candidates.push(payload.organization.id);
    if (Array.isArray(payload.organizations)) {
      for (const entry of payload.organizations) {
        if (typeof entry === "string") candidates.push(entry);
        else if (typeof entry?.id === "string") candidates.push(entry.id);
      }
    }
    return candidates.filter((id) => id.trim());
  } catch {
    return [];
  }
}

function orgCandidatesFromMe(body: MeResponse): string[] {
  const candidates: string[] = [];
  if (typeof body.organization_id === "string") candidates.push(body.organization_id);
  if (typeof body.org_id === "string") candidates.push(body.org_id);
  if (typeof body.organization?.id === "string") candidates.push(body.organization.id);
  for (const entry of body.organizations ?? []) {
    if (typeof entry?.id === "string") candidates.push(entry.id);
  }
  return candidates.filter((id) => id.trim());
}

function reportingTokenFromResponse(raw: string): string | null {
  const match = raw.match(/rpt[_-][A-Za-z0-9._-]+/);
  return match?.[0] ?? null;
}

export function createNearAiReportingClient(options: {
  store: NearAiRefreshTokenStore;
  loadExpiresAt?: () => Promise<Date | null>;
  readReporting: () => Promise<NearAiReportingCredentials>;
  baseUrl?: string;
  fetch?: typeof fetch;
}): NearAiReportingClient {
  const baseUrl = (options.baseUrl ?? "https://cloud-api.near.ai/v1").replace(/\/+$/, "");
  const saveRotated = async (refreshToken: string) => {
    const expiresAt = options.loadExpiresAt ? await options.loadExpiresAt() : null;
    await options.store.save(refreshToken, expiresAt).catch(() => undefined);
  };
  const fetchImpl: typeof fetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  const mintAccessToken = async (): Promise<{ token: string; refreshToken: string }> => {
    const refreshToken = await options.store.load();
    if (!refreshToken) {
      throw new NearAiRequestError("NEAR AI session not signed in", 401);
    }
    const response = await fetchImpl(`${baseUrl}/users/me/access-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}`, "User-Agent": PLUGIN_USER_AGENT },
    });
    if (!response.ok) throw await requestError(response, "start a session");
    const body = (await response.json()) as AccessTokenResponse;
    return { token: body.access_token, refreshToken: body.refresh_token ?? refreshToken };
  };

  const requestReportingApi = async (
    path: string,
    action: string,
    init?: RequestInit,
  ): Promise<Response> => {
    const { orgId, reportingToken } = await options.readReporting();
    if (!orgId || !reportingToken) {
      throw new NearAiRequestError("NEAR AI usage reporting is not configured", 401);
    }
    const url = `${baseUrl}/organizations/${encodeURIComponent(orgId)}${path}`;
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${reportingToken}`,
        "Content-Type": "application/json",
        "User-Agent": PLUGIN_USER_AGENT,
        ...init?.headers,
      },
    });
    if (!response.ok) throw await requestError(response, action);
    return response;
  };

  const parseSummary = (body: UsageSummaryResponse): NearAiOrganizationUsage => {
    const usedNanoUsdByKeyId = new Map<string, number>();
    for (const entry of body.by_api_key ?? []) {
      if (entry.api_key_id && typeof entry.total_cost_nano_usd === "number") {
        usedNanoUsdByKeyId.set(entry.api_key_id, entry.total_cost_nano_usd);
      }
    }
    return {
      totals: {
        usedNanoUsd: body.totals?.total_cost_nano_usd ?? 0,
        requestCount: body.totals?.request_count ?? 0,
      },
      usedNanoUsdByKeyId,
    };
  };

  let cachedUsage: { value: NearAiOrganizationUsage; expiresAt: number } | null = null;

  return {
    async provision() {
      try {
        const { token, refreshToken } = await mintAccessToken();
        await saveRotated(refreshToken);
        const candidates = orgCandidatesFromToken(token);
        try {
          const me = await fetchImpl(`${baseUrl}/users/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "User-Agent": PLUGIN_USER_AGENT,
            },
          });
          if (me.ok) {
            candidates.push(...orgCandidatesFromMe((await me.json()) as MeResponse));
          }
        } catch (error) {
          console.warn("[Credits] NEAR AI org lookup failed:", error);
        }
        const orgId = candidates[0] ?? null;
        if (!orgId) {
          console.warn("[Credits] NEAR AI organization id could not be discovered");
          return null;
        }
        const response = await fetchImpl(
          `${baseUrl}/organizations/${encodeURIComponent(orgId)}/reporting-tokens`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": PLUGIN_USER_AGENT,
            },
            body: JSON.stringify({ name: "nearbuilders-usage" }),
          },
        );
        if (!response.ok) throw await requestError(response, "create a usage reporting token");
        const reportingToken = reportingTokenFromResponse(await response.text());
        if (!reportingToken) {
          console.warn("[Credits] NEAR AI reporting token response was not recognized");
          return null;
        }
        cachedUsage = null;
        return { orgId, reportingToken };
      } catch (error) {
        console.warn("[Credits] NEAR AI usage reporting could not be provisioned:", error);
        return null;
      }
    },

    async getOrganizationUsage() {
      if (cachedUsage && cachedUsage.expiresAt > Date.now()) return cachedUsage.value;
      try {
        const summary = await requestReportingApi("/usage/summary", "read usage", {
          method: "GET",
        });
        const value = parseSummary((await summary.json()) as UsageSummaryResponse);
        cachedUsage = { value, expiresAt: Date.now() + USAGE_CACHE_TTL_MS };
        return value;
      } catch (error) {
        console.warn("[Credits] NEAR AI usage summary could not be read:", error);
        return null;
      }
    },

    async getKeyUsage({ apiKeyId, startTime }) {
      try {
        const params = new URLSearchParams({
          api_key_id: apiKeyId,
          start_time: startTime.toISOString(),
        });
        const summary = await requestReportingApi(`/usage/summary?${params}`, "read usage", {
          method: "GET",
        });
        return parseSummary((await summary.json()) as UsageSummaryResponse).totals;
      } catch (error) {
        console.warn("[Credits] NEAR AI key usage could not be read:", error);
        return null;
      }
    },
  };
}
