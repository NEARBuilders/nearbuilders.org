import { describe, expect, it, vi } from "vitest";
import {
  accessTokenExpiresAt,
  createNearAiKeyClient,
  NearAiRequestError,
} from "@/services/nearai-keys";

const BASE = "https://nearai.test/v1";
const WORKSPACE = "ws-1";

function jwt(exp: number) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function apiKey(id: string, name: string, extra: Record<string, unknown> = {}) {
  return { id, name, key_prefix: `sk-${id}`, is_active: true, ...extra };
}

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const saved: string[] = [];
  let stored: string | null = null;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) =>
    handler(String(input), init ?? {}),
  );
  const client = createNearAiKeyClient({
    refreshToken: "rt_env",
    userAgent: "Mozilla/5.0 Test",
    workspaceId: WORKSPACE,
    baseUrl: BASE,
    fetch: fetchMock as unknown as typeof fetch,
    store: {
      load: async () => stored,
      save: async (token) => {
        saved.push(token);
        stored = token;
      },
    },
  });
  return { client, fetchMock, saved };
}

function sessionResponse(refreshToken = "rt_env") {
  return json({
    access_token: jwt(Math.floor(Date.now() / 1000) + 3600),
    refresh_token: refreshToken,
    refresh_token_expiration: "2027-01-01T00:00:00Z",
  });
}

describe("accessTokenExpiresAt", () => {
  it("reads the JWT exp claim", () => {
    expect(accessTokenExpiresAt(jwt(1_800_000_000))).toBe(1_800_000_000_000);
  });

  it("falls back to a short lifetime for tokens it cannot decode", () => {
    expect(accessTokenExpiresAt("opaque", 1000)).toBe(1000 + 5 * 60_000);
  });
});

describe("createNearAiKeyClient", () => {
  it("creates a key with the spend limit in nano-dollars and the expiry", async () => {
    const { client, fetchMock } = setup((url, init) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      expect(url).toBe(`${BASE}/workspaces/${WORKSPACE}/api-keys`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(String(init.body))).toEqual({
        name: "nearbuilders-credit-1",
        expires_at: "2026-11-25T23:59:00.000Z",
        spendLimit: { amount: 5_000_000_000, currency: "USD" },
      });
      return json(apiKey("k1", "nearbuilders-credit-1", { key: "sk-secret" }), 201);
    });

    const created = await client.createKey({
      name: "nearbuilders-credit-1",
      spendLimitCents: 500,
      expiresAt: new Date("2026-11-25T23:59:00Z"),
    });

    expect(created).toEqual({
      id: "k1",
      name: "nearbuilders-credit-1",
      keyPrefix: "sk-k1",
      isActive: true,
      key: "sk-secret",
    });
    const sessionCall = fetchMock.mock.calls[0]!;
    expect(sessionCall[1]?.headers).toEqual({
      Authorization: "Bearer rt_env",
      "User-Agent": "Mozilla/5.0 Test",
    });
  });

  it("reuses the access token until it nears expiry", async () => {
    const { client, fetchMock } = setup((url) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      return new Response(null, { status: 204 });
    });

    await client.revokeKey("a");
    await client.revokeKey("b");

    const sessionCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/users/me/access-tokens"),
    );
    expect(sessionCalls).toHaveLength(1);
  });

  it("persists a rotated refresh token and uses it next time", async () => {
    const authHeaders: string[] = [];
    const { client, saved } = setup((url, init) => {
      if (url.endsWith("/users/me/access-tokens")) {
        authHeaders.push((init.headers as Record<string, string>).Authorization!);
        return json({
          access_token: jwt(Math.floor(Date.now() / 1000) + 30),
          refresh_token: `rt_rotated_${authHeaders.length}`,
          refresh_token_expiration: "2027-01-01T00:00:00Z",
        });
      }
      return new Response(null, { status: 204 });
    });

    await client.revokeKey("a");
    await client.revokeKey("b");

    expect(authHeaders).toEqual(["Bearer rt_env", "Bearer rt_rotated_1"]);
    expect(saved).toEqual(["rt_rotated_1", "rt_rotated_2"]);
  });

  it("starts only one session for concurrent requests", async () => {
    const { client, fetchMock } = setup((url) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      return new Response(null, { status: 204 });
    });

    await Promise.all([client.revokeKey("a"), client.revokeKey("b"), client.revokeKey("c")]);

    const sessionCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/users/me/access-tokens"),
    );
    expect(sessionCalls).toHaveLength(1);
  });

  it("pages through keys to find one by name", async () => {
    const offsets: string[] = [];
    const { client } = setup((url) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      const offset = new URL(url).searchParams.get("offset")!;
      offsets.push(offset);
      if (offset === "0") {
        return json({
          api_keys: Array.from({ length: 100 }, (_, i) => apiKey(`k${i}`, `other-${i}`)),
          total: 101,
          limit: 100,
          offset: 0,
        });
      }
      return json({ api_keys: [apiKey("k100", "target")], total: 101, limit: 100, offset: 100 });
    });

    await expect(client.findKeyByName("target")).resolves.toMatchObject({ id: "k100" });
    expect(offsets).toEqual(["0", "100"]);
  });

  it("returns null when no key has the name", async () => {
    const { client } = setup((url) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      return json({ api_keys: [apiKey("k1", "other")], total: 1, limit: 100, offset: 0 });
    });

    await expect(client.findKeyByName("target")).resolves.toBeNull();
  });

  it("treats revoking a missing key as done", async () => {
    const { client } = setup((url) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      return json({ error: { message: "not found", type: "not_found" } }, 404);
    });

    await expect(client.revokeKey("gone")).resolves.toBeUndefined();
  });

  it("reports NEAR AI errors with their status and message", async () => {
    const { client } = setup((url) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      return json({ error: { message: "insufficient credits", type: "payment" } }, 402);
    });

    const error = await client
      .createKey({ name: "n", spendLimitCents: 500, expiresAt: new Date() })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(NearAiRequestError);
    expect(error.status).toBe(402);
    expect(error.message).toContain("insufficient credits");
  });

  it("fails when the session cannot be started", async () => {
    const { client } = setup(() => json({ error: { message: "expired", type: "auth" } }, 401));

    await expect(client.revokeKey("a")).rejects.toThrow("could not start a session");
  });

  it("rejects a create response without key material", async () => {
    const { client } = setup((url) => {
      if (url.endsWith("/users/me/access-tokens")) return sessionResponse();
      return json(apiKey("k1", "n"), 201);
    });

    await expect(
      client.createKey({ name: "n", spendLimitCents: 500, expiresAt: new Date() }),
    ).rejects.toThrow("without returning it");
  });
});
