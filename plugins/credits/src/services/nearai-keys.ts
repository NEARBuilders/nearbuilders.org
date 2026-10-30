import { base58, base64 } from "@scure/base";
import type { z } from "zod";
import type { NearAiLoginPayloadSchema, NearAiSignedMessageSchema } from "../contract";

const NEAR_AI_BASE_URL = "https://cloud-api.near.ai/v1";

export const PLUGIN_USER_AGENT = "nearbuilders-credits/1.0 (nearbuilders.org)";

const ED25519_KEY_PREFIX = "ed25519:";

export function signatureToBase64(signature: string): string {
  const value = signature.trim();
  if (!value.toLowerCase().startsWith(ED25519_KEY_PREFIX)) return value;
  try {
    return base64.encode(base58.decode(value.slice(ED25519_KEY_PREFIX.length)));
  } catch {
    throw new NearAiRequestError("Wallet returned an undecodable signature", 401);
  }
}

export type NearAiKey = {
  id: string;
  name: string | null;
  keyPrefix: string;
  isActive: boolean;
};

export type CreatedNearAiKey = NearAiKey & { key: string };

export type NearAiRefreshTokenStore = {
  load(): Promise<string | null>;
  save(refreshToken: string, expiresAt: Date | null): Promise<void>;
};

export type NearAiSignedMessage = z.infer<typeof NearAiSignedMessageSchema>;

export type NearAiLoginPayload = z.infer<typeof NearAiLoginPayloadSchema>;

export type NearAiKeyClient = {
  createKey(input: {
    name: string;
    spendLimitCents: number;
    expiresAt: Date;
  }): Promise<CreatedNearAiKey>;
  findKeyByName(name: string): Promise<NearAiKey | null>;
  revokeKey(id: string): Promise<void>;
  verifySession(): Promise<void>;
  resetSession(): void;
};

export type NearAiLoginResult = {
  refreshToken: string;
  refreshExpiresAt: Date | null;
};

export type NearAiLoginClient = {
  login(input: {
    signedMessage: NearAiSignedMessage;
    payload: NearAiLoginPayload;
  }): Promise<NearAiLoginResult>;
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
  refresh_token_expiration?: string | null;
};

const NANO_DOLLARS_PER_CENT = 10_000_000;
const ACCESS_TOKEN_FALLBACK_TTL_MS = 5 * 60_000;
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60_000;
const LIST_PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 30_000;

export function accessTokenExpiresAt(token: string, now = Date.now()): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {}
  return now + ACCESS_TOKEN_FALLBACK_TTL_MS;
}

async function requestError(response: Response, action: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string } | string;
    error_description?: string;
    message?: string;
  } | null;
  const detail =
    typeof body?.error === "string"
      ? (body.error_description ?? body.error)
      : (body?.error?.message ?? body?.message ?? response.statusText);
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
  store: NearAiRefreshTokenStore;
  workspaceId: () => string | Promise<string>;
  baseUrl?: string;
  fetch?: typeof fetch;
}): NearAiKeyClient {
  const baseUrl = (options.baseUrl ?? NEAR_AI_BASE_URL).replace(/\/+$/, "");
  const workspaceUrl = (workspaceId: string) =>
    `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}`;
  const fetchImpl: typeof fetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  let access: { token: string; expiresAt: number } | null = null;
  let minting: Promise<string> | null = null;

  const mintAccessToken = async () => {
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
    const expiresAt = body.refresh_token_expiration
      ? new Date(body.refresh_token_expiration)
      : null;
    const parsedExpiry = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
    await options.store.save(body.refresh_token ?? refreshToken, parsedExpiry);
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
    const workspace = await options.workspaceId();
    if (!workspace.trim()) {
      throw new NearAiRequestError("NEAR AI workspace not configured", 401);
    }
    const response = await fetchImpl(`${workspaceUrl(workspace)}${path}`, {
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

    async verifySession() {
      await accessToken();
    },

    resetSession() {
      access = null;
      minting = null;
    },
  };
}

export function createNearAiLoginClient(options: {
  baseUrl?: string;
  fetch?: typeof fetch;
}): NearAiLoginClient {
  const baseUrl = (options.baseUrl ?? NEAR_AI_BASE_URL).replace(/\/+$/, "");
  const fetchImpl: typeof fetch = (input, init) =>
    (options.fetch ?? fetch)(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

  return {
    async login({ signedMessage, payload }) {
      const response = await fetchImpl(`${baseUrl}/auth/near`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": PLUGIN_USER_AGENT },
        body: JSON.stringify({
          signed_message: {
            accountId: signedMessage.accountId,
            publicKey: signedMessage.publicKey,
            signature: signedMessage.signature,
            ...(signedMessage.state ? { state: signedMessage.state } : {}),
          },
          payload: {
            message: payload.message,
            nonce: payload.nonce,
            recipient: payload.recipient,
            ...(payload.callbackUrl ? { callbackUrl: payload.callbackUrl } : {}),
          },
        }),
      });
      if (!response.ok) throw await requestError(response, "sign in to NEAR AI Cloud");
      const body = (await response.json()) as AccessTokenResponse;
      if (!body.refresh_token) {
        throw new NearAiRequestError(
          "NEAR AI signed in without returning a refresh token",
          response.status,
        );
      }
      const expiresAt = body.refresh_token_expiration
        ? new Date(body.refresh_token_expiration)
        : null;
      return {
        refreshToken: body.refresh_token,
        refreshExpiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      };
    },
  };
}
