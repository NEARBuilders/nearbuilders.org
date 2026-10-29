const NEAR_AI_BASE_URL = "https://cloud-api.near.ai/v1";

export type NearAiKey = {
  id: string;
  name: string | null;
  keyPrefix: string;
  isActive: boolean;
};

export type CreatedNearAiKey = NearAiKey & { key: string };

export type NearAiRefreshTokenStore = {
  load(): Promise<string | null>;
  save(refreshToken: string): Promise<void>;
};

export type NearAiKeyClient = {
  createKey(input: {
    name: string;
    spendLimitCents: number;
    expiresAt: Date;
  }): Promise<CreatedNearAiKey>;
  findKeyByName(name: string): Promise<NearAiKey | null>;
  revokeKey(id: string): Promise<void>;
};

export class NearAiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "NearAiRequestError";
  }
}

type ApiKeyResponse = {
  id: string;
  name?: string | null;
  key?: string | null;
  key_prefix: string;
  is_active: boolean;
};

type ListApiKeysResponse = {
  api_keys: ApiKeyResponse[];
  total: number;
};

type AccessTokenResponse = {
  access_token: string;
  refresh_token: string;
};

const NANO_DOLLARS_PER_CENT = 10_000_000;
const ACCESS_TOKEN_FALLBACK_TTL_MS = 5 * 60_000;
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000;
const LIST_PAGE_SIZE = 100;

export function accessTokenExpiresAt(token: string, now = Date.now()): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {}
  return now + ACCESS_TOKEN_FALLBACK_TTL_MS;
}

async function requestError(response: Response, action: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  const detail = body?.error?.message ?? response.statusText;
  return new NearAiRequestError(
    `NEAR AI could not ${action} (${response.status}${detail ? `: ${detail}` : ""})`,
    response.status,
  );
}

function toKey(response: ApiKeyResponse): NearAiKey {
  return {
    id: response.id,
    name: response.name ?? null,
    keyPrefix: response.key_prefix,
    isActive: response.is_active,
  };
}

export function createNearAiKeyClient(options: {
  refreshToken: string;
  userAgent: string;
  workspaceId: string;
  store: NearAiRefreshTokenStore;
  baseUrl?: string;
  fetch?: typeof fetch;
}): NearAiKeyClient {
  const baseUrl = (options.baseUrl ?? NEAR_AI_BASE_URL).replace(/\/+$/, "");
  const workspaceUrl = `${baseUrl}/workspaces/${encodeURIComponent(options.workspaceId)}`;
  const fetchImpl: typeof fetch = (input, init) => (options.fetch ?? fetch)(input, init);
  let access: { token: string; expiresAt: number } | null = null;
  let minting: Promise<string> | null = null;

  const mintAccessToken = async () => {
    const refreshToken = (await options.store.load()) ?? options.refreshToken;
    const response = await fetchImpl(`${baseUrl}/users/me/access-tokens`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}`, "User-Agent": options.userAgent },
    });
    if (!response.ok) throw await requestError(response, "start a session");
    const body = (await response.json()) as AccessTokenResponse;
    if (body.refresh_token && body.refresh_token !== refreshToken) {
      await options.store.save(body.refresh_token);
    }
    access = { token: body.access_token, expiresAt: accessTokenExpiresAt(body.access_token) };
    return body.access_token;
  };

  const accessToken = () => {
    if (access && access.expiresAt - ACCESS_TOKEN_REFRESH_MARGIN_MS > Date.now()) {
      return Promise.resolve(access.token);
    }
    minting ??= mintAccessToken().finally(() => {
      minting = null;
    });
    return minting;
  };

  const request = async (path: string, init: RequestInit, action: string) => {
    const response = await fetchImpl(`${workspaceUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
    });
    if (response.status === 401) access = null;
    if (!response.ok) throw await requestError(response, action);
    return response;
  };

  return {
    async createKey({ name, spendLimitCents, expiresAt }) {
      const response = await request(
        "/api-keys",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            expires_at: expiresAt.toISOString(),
            spendLimit: { amount: spendLimitCents * NANO_DOLLARS_PER_CENT, currency: "USD" },
          }),
        },
        "create an API key",
      );
      const body = (await response.json()) as ApiKeyResponse;
      if (!body.key) {
        throw new NearAiRequestError("NEAR AI created a key without returning it", response.status);
      }
      return { ...toKey(body), key: body.key };
    },

    async findKeyByName(name) {
      for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
        const response = await request(
          `/api-keys?limit=${LIST_PAGE_SIZE}&offset=${offset}`,
          { method: "GET" },
          "list API keys",
        );
        const body = (await response.json()) as ListApiKeysResponse;
        const match = body.api_keys.find((key) => key.name === name);
        if (match) return toKey(match);
        if (body.api_keys.length < LIST_PAGE_SIZE || offset + LIST_PAGE_SIZE >= body.total) {
          return null;
        }
      }
    },

    async revokeKey(id) {
      try {
        await request(
          `/api-keys/${encodeURIComponent(id)}`,
          { method: "DELETE" },
          "revoke the API key",
        );
      } catch (error) {
        if (error instanceof NearAiRequestError && error.status === 404) return;
        throw error;
      }
    },
  };
}
