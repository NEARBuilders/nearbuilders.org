import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import CreditsPlugin from "@/index";

type FakeKey = { id: string; name: string; key_prefix: string; is_active: boolean };

const NEAR_AI = "https://cloud-api.near.ai/v1";
const WORKSPACE = "ws-hackathon";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeNearAi() {
  const keys = new Map<string, FakeKey>();
  const usageByKey = new Map<string, number>();
  const requests: Array<{ method: string; url: string; body: unknown }> = [];
  const state = { failCreates: 0, createButLoseResponse: 0, created: 0 };
  const holds: Array<{ started: () => void; released: Promise<void> }> = [];
  const holdNextCreate = () => {
    let started!: () => void;
    let release!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    holds.push({ started, released });
    return { started: startedPromise, release };
  };
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ method, url, body });
    if (url === `${NEAR_AI}/auth/near` && method === "POST") {
      return json({
        access_token: "opaque-session",
        refresh_token: "rt_login",
        refresh_token_expiration: "2027-01-01T00:00:00Z",
      });
    }
    if (url === `${NEAR_AI}/users/me/access-tokens`) {
      return json({
        access_token: "opaque-session",
        refresh_token: "rt_test",
        refresh_token_expiration: "2027-01-01T00:00:00Z",
      });
    }
    const keysUrl = `${NEAR_AI}/workspaces/${WORKSPACE}/api-keys`;
    if (url === keysUrl && method === "POST") {
      const hold = holds.shift();
      if (hold) {
        hold.started();
        await hold.released;
      }
      if (state.failCreates > 0) {
        state.failCreates -= 1;
        return json({ error: { message: "upstream unavailable", type: "server" } }, 503);
      }
      state.created += 1;
      const key: FakeKey = {
        id: `key-${state.created}`,
        name: body.name,
        key_prefix: `sk-abc${state.created}`,
        is_active: true,
      };
      keys.set(key.id, key);
      if (state.createButLoseResponse > 0) {
        state.createButLoseResponse -= 1;
        throw new TypeError("socket hang up");
      }
      return json({ ...key, key: `sk-abc${state.created}-secret` }, 201);
    }
    if (url.startsWith(`${keysUrl}?`) && method === "GET") {
      const all = [...keys.values()];
      return json({ api_keys: all, total: all.length, limit: 100, offset: 0 });
    }
    if (url === `${NEAR_AI}/users/me` && method === "GET") {
      return json({ organization_id: "org-1" });
    }
    if (url === `${NEAR_AI}/organizations/org-1/reporting-tokens` && method === "POST") {
      return json({ token: "rpt-test-token", name: body?.name ?? null });
    }
    if (url.startsWith(`${NEAR_AI}/organizations/org-1/usage/summary`) && method === "GET") {
      const apiKeyId = new URL(url).searchParams.get("api_key_id");
      if (apiKeyId) {
        return json({
          totals: {
            request_count: usageByKey.has(apiKeyId) ? 1 : 0,
            total_cost_nano_usd: usageByKey.get(apiKeyId) ?? 0,
          },
          by_api_key: usageByKey.has(apiKeyId)
            ? [{ api_key_id: apiKeyId, total_cost_nano_usd: usageByKey.get(apiKeyId) }]
            : [],
        });
      }
      return json({
        totals: {
          request_count: usageByKey.size,
          total_cost_nano_usd: [...usageByKey.values()].reduce((sum, nano) => sum + nano, 0),
        },
        by_api_key: [...usageByKey.entries()].map(([api_key_id, total_cost_nano_usd]) => ({
          api_key_id,
          total_cost_nano_usd,
        })),
      });
    }
    if (url.startsWith(`${keysUrl}/`) && method === "DELETE") {
      const id = decodeURIComponent(url.slice(keysUrl.length + 1));
      const key = keys.get(id);
      if (!key) return json({ error: { message: "not found", type: "not_found" } }, 404);
      key.is_active = false;
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected NEAR AI request: ${method} ${url}`);
  });
  const activeKeys = () => [...keys.values()].filter((key) => key.is_active);
  return { keys, usageByKey, requests, state, fetchMock, holdNextCreate, activeKeys };
}

function userContext(
  userId: string,
  nearAccount: string | null,
  options: { role?: string; ip?: string } = {},
) {
  return {
    userId,
    user: {
      id: userId,
      name: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      role: options.role ?? "member",
      isAnonymous: false,
    },
    near: nearAccount
      ? { primaryAccountId: nearAccount, linkedAccounts: [], hasNearAccount: true }
      : { primaryAccountId: null, linkedAccounts: [], hasNearAccount: false },
    reqHeaders: new Headers(options.ip ? { "cf-connecting-ip": options.ip } : {}),
  };
}

const LOGIN_INPUT = {
  signedMessage: {
    accountId: "nearbuilding.near",
    publicKey: "ed25519:test-key",
    signature: "test-signature",
  },
  payload: {
    message: "Sign in to NEAR AI Cloud",
    nonce: Array.from({ length: 32 }, (_, index) => index),
    recipient: "cloud.near.ai",
  },
};

describe("Credit claims", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadCredits(
    options: { builders?: Record<string, { withdrawnAt: string | null }> } = {},
  ) {
    const nearAi = fakeNearAi();
    vi.stubGlobal("fetch", nearAi.fetchMock);
    const builders = options.builders ?? {
      "alice.near": { withdrawnAt: null },
      "bob.near": { withdrawnAt: null },
    };
    const runtime = createPluginRuntime({ registry: { credits: { module: CreditsPlugin } } });
    runtimes.push(runtime);
    const loaded = await runtime.usePlugin(
      "credits",
      { variables: {}, secrets: { CREDITS_DATABASE_URL: "pglite::memory:" } },
      {
        builders: {
          client: (context: { near?: { primaryAccountId?: string | null } }) => ({
            getMyBuilderProfile: async () => {
              const account = context.near?.primaryAccountId?.toLowerCase();
              const profile = account ? builders[account] : undefined;
              return {
                data: profile
                  ? {
                      id: `builder-${account}`,
                      nearAccount: account,
                      userId: null,
                      name: account,
                      bio: null,
                      skills: [],
                      location: null,
                      links: null,
                      withdrawnAt: profile.withdrawnAt,
                      createdAt: "2026-10-01T00:00:00.000Z",
                      updatedAt: "2026-10-01T00:00:00.000Z",
                    }
                  : null,
              };
            },
          }),
        },
      },
    );
    const client = (context: ReturnType<typeof userContext>) =>
      loaded.createClient(context as never);
    const admin = client(userContext("admin-user", "admin.near", { role: "admin" }));
    return { loaded, client, admin, nearAi };
  }

  async function enable(
    admin: Awaited<ReturnType<typeof loadCredits>>["admin"],
    overrides: Record<string, unknown> = {},
  ) {
    await admin.updateCreditSettings({
      enabled: true,
      amountUsd: 5,
      claimsCloseAt: "2999-01-01T00:00:00Z",
      keyExpiresAt: "2999-02-01T00:00:00Z",
      nearAiWorkspaceId: WORKSPACE,
      nearAiLoginAccountId: "nearbuilding.near",
      ...overrides,
    } as never);
    await admin.loginNearAi(LOGIN_INPUT as never);
  }

  it("issues a capped, expiring key to an approved builder once", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "Alice.near", { ip: "203.0.113.7" }));

    await expect(alice.getCreditStatus({})).resolves.toEqual({
      available: true,
      statusReason: null,
      amountUsd: 5,
      claimsCloseAt: "2999-01-01T00:00:00.000Z",
      eligibility: "eligible",
      claim: null,
    });

    const claimed = await alice.claimCredits({});
    expect(claimed.key).toBe("sk-abc1-secret");
    expect(claimed.claim).toMatchObject({
      status: "issued",
      keyPrefix: "sk-abc1",
      spendLimitUsd: 5,
      keyExpiresAt: "2999-02-01T00:00:00.000Z",
    });

    const create = nearAi.requests.find(
      (request) => request.url.endsWith("/api-keys") && request.method === "POST",
    );
    expect(create?.body).toEqual({
      name: `alice.near-nearbuilders-credit-${claimed.claim.id}`,
      expires_at: "2999-02-01T00:00:00.000Z",
      spendLimit: { amount: 5_000_000_000, currency: "USD" },
    });

    const status = await alice.getCreditStatus({});
    expect(status.claim).toEqual(claimed.claim);
    expect(JSON.stringify(status)).not.toContain("sk-abc1-secret");

    await expect(alice.claimCredits({})).rejects.toMatchObject({
      code: "CONFLICT",
      message: "API credits were already claimed for this account",
    });
    expect(nearAi.state.created).toBe(1);
  });

  it("issues only one key when the same builder claims concurrently", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near"));

    const results = await Promise.allSettled([
      alice.claimCredits({}),
      alice.claimCredits({}),
      alice.claimCredits({}),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(nearAi.state.created).toBe(1);
  });

  it("refuses builders without an approved profile", async () => {
    const { client, admin, nearAi } = await loadCredits({
      builders: { "withdrawn.near": { withdrawnAt: "2026-10-02T00:00:00.000Z" } },
    });
    await enable(admin);

    const newcomer = client(userContext("new-user", "newcomer.near"));
    await expect(newcomer.getCreditStatus({})).resolves.toMatchObject({
      eligibility: "needs_approved_profile",
    });
    await expect(newcomer.claimCredits({})).rejects.toMatchObject({ code: "FORBIDDEN" });

    const withdrawn = client(userContext("w-user", "withdrawn.near"));
    await expect(withdrawn.getCreditStatus({})).resolves.toMatchObject({
      eligibility: "needs_profile_restore",
    });
    await expect(withdrawn.claimCredits({})).rejects.toMatchObject({ code: "FORBIDDEN" });

    const noNear = client(userContext("google-user", null));
    await expect(noNear.getCreditStatus({})).resolves.toMatchObject({
      eligibility: "needs_near_account",
    });
    await expect(noNear.claimCredits({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Link a NEAR account to claim API credits",
    });

    expect(nearAi.state.created).toBe(0);
  });

  it("requires a signed-in user", async () => {
    const { loaded } = await loadCredits();
    const anonymous = loaded.createClient({} as never);

    await expect(anonymous.getCreditStatus({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.claimCredits({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses claims when disabled", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin, { enabled: false });
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: false,
      statusReason: "not_enabled",
    });
    await expect(alice.claimCredits({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Credit claims are not enabled",
    });
    expect(nearAi.state.created).toBe(0);
  });

  it("refuses claims after the close time", async () => {
    const { client, admin } = await loadCredits();
    await enable(admin, { claimsCloseAt: "2000-01-01T00:00:00Z" });
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: false,
      statusReason: "closed",
    });
    await expect(alice.claimCredits({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Credit claims are closed",
    });
  });

  it("refuses claims before any configuration exists", async () => {
    const { client, admin } = await loadCredits();
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: false,
      statusReason: "not_configured",
      amountUsd: 0,
    });
    await expect(alice.claimCredits({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Credit claims are not configured",
    });
    await expect(admin.getCreditSettings({})).resolves.toEqual({ settings: null });
  });

  it("refuses to save open claims without a workspace", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    await expect(
      admin.updateCreditSettings({
        enabled: true,
        amountUsd: 5,
        claimsCloseAt: "2999-01-01T00:00:00Z",
        keyExpiresAt: "2999-02-01T00:00:00Z",
        nearAiWorkspaceId: "",
        nearAiLoginAccountId: "nearbuilding.near",
      } as never),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Open claims require a NEAR AI workspace ID",
    });
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: true,
      statusReason: null,
    });
    await expect(alice.claimCredits({})).resolves.toMatchObject({ claim: { status: "issued" } });
    expect(nearAi.state.created).toBe(1);
  });

  it("requires a NEAR AI session to claim and recovers after signing in", async () => {
    const { client, admin, nearAi } = await loadCredits();
    const alice = client(userContext("alice-user", "alice.near"));

    await admin.updateCreditSettings({
      enabled: true,
      amountUsd: 5,
      claimsCloseAt: "2999-01-01T00:00:00Z",
      keyExpiresAt: "2999-02-01T00:00:00Z",
      nearAiWorkspaceId: WORKSPACE,
      nearAiLoginAccountId: "nearbuilding.near",
    } as never);

    await expect(admin.nearAiSessionStatus({})).resolves.toEqual({
      status: "absent",
      refreshExpiresAt: null,
      usageReporting: false,
    });

    await expect(alice.claimCredits({})).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(admin.listCreditClaims({ limit: 10 })).resolves.toMatchObject({
      data: [{ status: "failed", error: "NEAR AI session not signed in" }],
    });
    expect(nearAi.state.created).toBe(0);

    await admin.loginNearAi(LOGIN_INPUT as never);
    await expect(admin.nearAiSessionStatus({})).resolves.toEqual({
      status: "valid",
      refreshExpiresAt: "2027-01-01T00:00:00.000Z",
      usageReporting: true,
    });

    const retried = await alice.claimCredits({});
    expect(retried.claim.status).toBe("issued");
    expect(nearAi.state.created).toBe(1);
  });

  it("rejects a login signed by a different account than the guardrail", async () => {
    const { admin } = await loadCredits();
    await admin.updateCreditSettings({
      enabled: true,
      amountUsd: 5,
      claimsCloseAt: "2999-01-01T00:00:00Z",
      keyExpiresAt: "2999-02-01T00:00:00Z",
      nearAiWorkspaceId: WORKSPACE,
      nearAiLoginAccountId: "nearbuilding.near",
    } as never);

    await expect(
      admin.loginNearAi({
        signedMessage: { ...LOGIN_INPUT.signedMessage, accountId: "someone-else.near" },
        payload: LOGIN_INPUT.payload,
      } as never),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only nearbuilding.near can sign in the NEAR AI credentials",
    });
  });

  it("supports claiming without a claims close date", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin, { claimsCloseAt: null });
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: true,
      claimsCloseAt: null,
    });
    await expect(alice.claimCredits({})).resolves.toMatchObject({ claim: { status: "issued" } });
    expect(nearAi.state.created).toBe(1);
  });

  it("supports claiming without a key expiry — keys never expire", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin, { claimsCloseAt: null, keyExpiresAt: null });
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: true,
      claim: null,
    });

    const claimed = await alice.claimCredits({});
    expect(claimed.claim).toMatchObject({ status: "issued", keyExpiresAt: null });

    const create = nearAi.requests.find(
      (request) => request.url.endsWith("/api-keys") && request.method === "POST",
    );
    expect(create?.body).toEqual({
      name: `alice.near-nearbuilders-credit-${claimed.claim.id}`,
      spendLimit: { amount: 5_000_000_000, currency: "USD" },
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("3000-01-01T00:00:00Z"));
    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: true,
      claim: { status: "issued" },
    });
  });

  it("lets a builder retry after NEAR AI fails", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    nearAi.state.failCreates = 1;
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.claimCredits({})).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      claim: { status: "failed" },
    });

    const retried = await alice.claimCredits({});
    expect(retried.claim.status).toBe("issued");
    expect(nearAi.state.created).toBe(1);
  });

  it("revokes a key that was created when its response was lost, then issues a new one", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    nearAi.state.createButLoseResponse = 1;
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.claimCredits({})).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(nearAi.keys.get("key-1")?.is_active).toBe(true);

    const retried = await alice.claimCredits({});
    expect(retried.key).toBe("sk-abc2-secret");
    expect(nearAi.keys.get("key-1")?.is_active).toBe(false);
    expect(nearAi.keys.get("key-2")?.is_active).toBe(true);
  });

  it("lets admins list claims with same-IP counts and revoke keys", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near", { ip: "203.0.113.7" }));
    const bob = client(userContext("bob-user", "bob.near", { ip: "203.0.113.7" }));
    const aliceClaim = await alice.claimCredits({});
    await bob.claimCredits({});

    const listed = await admin.listCreditClaims({ limit: 1 });
    expect(listed.meta).toEqual({ total: 2, hasMore: true, nextCursor: "1" });
    expect(listed.data[0]).toMatchObject({ ip: "203.0.113.7", ipClaimCount: 2, error: null });
    const nextPage = await admin.listCreditClaims({ limit: 1, cursor: "1" });
    expect(nextPage.meta.hasMore).toBe(false);
    expect([listed.data[0]!.nearAccountId, nextPage.data[0]!.nearAccountId].sort()).toEqual([
      "alice.near",
      "bob.near",
    ]);

    const revoked = await admin.revokeCreditClaim({ id: aliceClaim.claim.id });
    expect(revoked.data).toMatchObject({ status: "revoked", nearAccountId: "alice.near" });
    expect(revoked.data.revokedAt).not.toBeNull();
    expect(nearAi.keys.get("key-1")?.is_active).toBe(false);

    await expect(admin.revokeCreditClaim({ id: aliceClaim.claim.id })).resolves.toMatchObject({
      data: { status: "revoked" },
    });
    await expect(alice.claimCredits({})).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(admin.revokeCreditClaim({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reports claimed-key usage to builders and admins", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.getCreditUsage({})).resolves.toEqual({ usage: null });
    await alice.claimCredits({});
    await expect(alice.getCreditUsage({})).resolves.toEqual({
      usage: { usedUsd: 0, spendLimitUsd: 5, keyExpiresAt: "2999-02-01T00:00:00.000Z" },
    });

    const bob = client(userContext("bob-user", "bob.near"));
    await bob.claimCredits({});
    nearAi.usageByKey.set("key-1", 500_000_000);
    nearAi.usageByKey.set("key-2", 1_250_000_000);

    await expect(alice.getCreditUsage({})).resolves.toEqual({
      usage: { usedUsd: 0.5, spendLimitUsd: 5, keyExpiresAt: "2999-02-01T00:00:00.000Z" },
    });
    await expect(bob.getCreditUsage({})).resolves.toEqual({
      usage: { usedUsd: 1.25, spendLimitUsd: 5, keyExpiresAt: "2999-02-01T00:00:00.000Z" },
    });

    const listed = await admin.listCreditClaims({ limit: 10 });
    expect(listed.data).toHaveLength(2);
    expect(listed.data.map((claim) => claim.usedUsd).sort()).toEqual([0.5, 1.25]);
  });

  it("lets an admin approve a replacement the builder saves on their dashboard", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near"));
    const claimed = await alice.claimCredits({});

    await expect(admin.refreshCreditClaim({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const approved = await admin.refreshCreditClaim({ id: claimed.claim.id });
    expect(approved.data).toMatchObject({ status: "replaceable", keyPrefix: null });
    expect(approved.data).not.toHaveProperty("key");
    expect(nearAi.keys.get("key-1")?.is_active).toBe(false);

    await expect(alice.claimCreditReplacement({})).resolves.toMatchObject({
      key: "sk-abc2-secret",
      claim: { status: "issued", keyPrefix: "sk-abc2", spendLimitUsd: 5 },
    });
    expect(nearAi.keys.get("key-2")?.is_active).toBe(true);

    const status = await alice.getCreditStatus({});
    expect(status.claim).toMatchObject({ status: "issued", keyPrefix: "sk-abc2" });
    expect(JSON.stringify(status)).not.toContain("sk-abc1-secret");

    await expect(alice.claimCreditReplacement({})).rejects.toMatchObject({ code: "CONFLICT" });
    await admin.revokeCreditClaim({ id: claimed.claim.id });
    await expect(admin.refreshCreditClaim({ id: claimed.claim.id })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("keeps admin routes away from members", async () => {
    const { client, admin } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.listCreditClaims({ limit: 10 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(alice.refreshCreditClaim({ id: "any" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(alice.revokeCreditClaim({ id: "any" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(alice.getCreditSettings({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      alice.updateCreditSettings({
        enabled: true,
        amountUsd: 1,
        claimsCloseAt: null,
        keyExpiresAt: null,
        nearAiWorkspaceId: "ws",
        nearAiLoginAccountId: "",
      } as never),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(alice.nearAiSessionStatus({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(alice.loginNearAi(LOGIN_INPUT as never)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(admin.nearAiSessionStatus({})).resolves.toMatchObject({ status: "valid" });
  });

  it("lets each signed-in builder claim once, even with several NEAR accounts", async () => {
    const { client, admin, nearAi } = await loadCredits({
      builders: { "alice.near": { withdrawnAt: null }, "alice-alt.near": { withdrawnAt: null } },
    });
    await enable(admin);

    await client(userContext("alice-user", "alice.near")).claimCredits({});
    const other = client(userContext("alice-user", "alice-alt.near"));
    await expect(other.claimCredits({})).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Credits were already claimed with alice.near",
    });

    const status = await other.getCreditStatus({});
    expect(status.claim).toMatchObject({
      status: "issued",
      nearAccountId: "alice.near",
    });

    expect(nearAi.state.created).toBe(1);
  });

  it("shows a key as expired after its expiry and never issues another", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near"));
    await alice.claimCredits({});

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2999-02-01T00:00:01Z"));

    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      available: false,
      claim: { status: "expired", keyExpiresAt: "2999-02-01T00:00:00.000Z" },
    });
    await expect(alice.claimCredits({})).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Credit claims are closed",
    });
    await expect(admin.listCreditClaims({ limit: 10 })).resolves.toMatchObject({
      data: [{ status: "expired" }],
    });
    expect(nearAi.state.created).toBe(1);
  });

  it("keeps a revocation and revokes the key when an admin revokes mid-claim", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near"));
    const hold = nearAi.holdNextCreate();

    const claiming = alice.claimCredits({});
    await hold.started;
    const [pending] = (await admin.listCreditClaims({ limit: 10 })).data;
    await admin.revokeCreditClaim({ id: pending!.id });
    hold.release();

    await expect(claiming).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      claim: { status: "revoked" },
    });
    expect(nearAi.state.created).toBe(1);
    expect(nearAi.activeKeys()).toHaveLength(0);
  });

  it("leaves one live key when a stale claim is retried while the first is still running", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    const alice = client(userContext("alice-user", "alice.near"));
    const hold = nearAi.holdNextCreate();

    const first = alice.claimCredits({});
    await hold.started;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 3 * 60_000));

    const second = await alice.claimCredits({});
    hold.release();

    await expect(first).rejects.toMatchObject({ code: "CONFLICT" });
    expect(second.claim.status).toBe("issued");
    expect(nearAi.state.created).toBe(2);
    expect(nearAi.activeKeys().map((key) => key.key_prefix)).toEqual([second.claim.keyPrefix]);
    await expect(alice.getCreditStatus({})).resolves.toMatchObject({
      claim: { status: "issued", keyPrefix: second.claim.keyPrefix },
    });
  });

  it("revokes a key whose creation response was lost when the claim is revoked", async () => {
    const { client, admin, nearAi } = await loadCredits();
    await enable(admin);
    nearAi.state.createButLoseResponse = 1;
    const alice = client(userContext("alice-user", "alice.near"));

    await expect(alice.claimCredits({})).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(nearAi.activeKeys()).toHaveLength(1);

    const [failed] = (await admin.listCreditClaims({ limit: 10 })).data;
    await admin.revokeCreditClaim({ id: failed!.id });

    expect(nearAi.activeKeys()).toHaveLength(0);
    await expect(alice.claimCredits({})).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
