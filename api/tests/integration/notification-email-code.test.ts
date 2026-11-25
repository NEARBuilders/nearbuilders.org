import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { createPluginRuntime } from "every-plugin";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";
import { asPluginEntries } from "../helpers/plugin-entries";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function member(id: string) {
  return {
    userId: id,
    near: { primaryAccountId: `${id}.near`, linkedAccounts: [], hasNearAccount: true },
    user: {
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      image: null,
      role: "member",
      isAnonymous: false,
      locale: null,
    },
  };
}

describe("notification email code endpoints", () => {
  const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
  const setEmailChallenge = vi.fn(async (input: { pendingEmail: string }) => ({
    pendingEmail: input.pendingEmail,
  }));
  const confirmEmailCode = vi.fn(async (_input: { userId: string; codeHash: string }) => ({
    email: "ada@example.com",
    verified: true,
    enabled: true,
    pendingEmail: null,
  }));
  const syncVerifiedEmail = vi.fn(async (input: { email: string }) => ({
    email: input.email,
    verified: true,
    enabled: true,
    pendingEmail: null,
  }));
  const notificationsClient = vi.fn((_context: unknown) => ({
    setEmailChallenge,
    confirmEmailCode,
    syncVerifiedEmail,
  }));
  const fetchMock = vi.fn<typeof fetch>();
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"api">>>;

  beforeAll(async () => {
    loaded = await runtime.usePlugin(
      "api",
      {
        variables: {},
        secrets: { API_DATABASE_URL: "pglite::memory:", RESEND_API_KEY: "test-key" },
      },
      asPluginEntries({
        activity: () => ({}),
        builders: () => ({}),
        events: () => ({}),
        nearcatalog: () => ({}),
        notifications: notificationsClient,
        projects: () => ({}),
        proposals: () => ({}),
        votes: () => ({}),
      } as never),
    );
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setEmailChallenge.mockClear();
    confirmEmailCode.mockClear();
    syncVerifiedEmail.mockClear();
    notificationsClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await runtime.shutdown();
  });

  it("emails the code to the requested address and stores only its hash", async () => {
    const client = loaded.createClient(member("ada"));

    await expect(
      client.requestNotificationEmailCode({ email: "ada@example.com" }),
    ).resolves.toEqual({ sent: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body)) as { to: string[]; text: string };
    expect(body.to).toEqual(["ada@example.com"]);
    const code = body.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeDefined();

    expect(setEmailChallenge).toHaveBeenCalledOnce();
    const challenge = setEmailChallenge.mock.calls[0]?.[0] as unknown as {
      userId: string;
      pendingEmail: string;
      codeHash: string;
      codeExpiresAt: string;
    };
    expect(challenge).toMatchObject({
      userId: "ada.near",
      pendingEmail: "ada@example.com",
      codeHash: sha256(code as string),
    });
    expect(JSON.stringify(challenge)).not.toContain(code as string);
    expect(Date.parse(challenge.codeExpiresAt)).toBeGreaterThan(Date.now());
  });

  it("sends no email when the request is rate limited", async () => {
    setEmailChallenge.mockRejectedValueOnce(
      new ORPCError("RATE_LIMITED", {
        message: "Too many verification codes requested. Try again in 30 seconds.",
        data: { retryAfter: 30 },
      }),
    );
    const client = loaded.createClient(member("ada"));

    await expect(
      client.requestNotificationEmailCode({ email: "ada@example.com" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", data: { retryAfter: 30 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unavailable mail provider instead of pretending the code was sent", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = loaded.createClient(member("ada"));

    await expect(
      client.requestNotificationEmailCode({ email: "ada@example.com" }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("confirms with the hash of the submitted code for the signed-in user", async () => {
    const client = loaded.createClient(member("ada"));

    await expect(client.confirmNotificationEmailCode({ code: "123456" })).resolves.toMatchObject({
      verified: true,
    });

    expect(confirmEmailCode).toHaveBeenCalledWith({
      userId: "ada.near",
      codeHash: sha256("123456"),
    });
  });

  it("passes a code lockout through to the caller", async () => {
    confirmEmailCode.mockRejectedValueOnce(
      new ORPCError("RATE_LIMITED", {
        message: "Too many incorrect codes. Request a new code to try again.",
        data: { retryAfter: 60 },
      }),
    );
    const client = loaded.createClient(member("ada"));

    await expect(client.confirmNotificationEmailCode({ code: "123456" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("calls the plugin as the server for every email verification step", async () => {
    const client = loaded.createClient(member("ada"));

    await client.requestNotificationEmailCode({ email: "ada@example.com" });
    await client.confirmNotificationEmailCode({ code: "123456" });
    await client.syncVerifiedNotificationEmail({ email: "ada@example.com" });

    expect(notificationsClient).toHaveBeenCalledTimes(3);
    for (const [context] of notificationsClient.mock.calls) {
      expect(context).toMatchObject({ serverNotification: true, userId: "ada.near" });
    }
  });

  it("syncs only the verified email of the current session", async () => {
    const client = loaded.createClient(member("ada"));

    await expect(
      client.syncVerifiedNotificationEmail({ email: "ada@example.com" }),
    ).resolves.toMatchObject({ email: "ada@example.com", verified: true });
    expect(syncVerifiedEmail).toHaveBeenCalledWith({
      userId: "ada.near",
      email: "ada@example.com",
    });

    await expect(
      client.syncVerifiedNotificationEmail({ email: "someone-else@example.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(syncVerifiedEmail).toHaveBeenCalledOnce();

    const unverified = loaded.createClient({
      ...member("bob"),
      user: { ...member("bob").user, emailVerified: false },
    });
    await expect(
      unverified.syncVerifiedNotificationEmail({ email: "bob@example.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(syncVerifiedEmail).toHaveBeenCalledOnce();
  });

  it("requires a signed-in user for both endpoints", async () => {
    const anonymous = loaded.createClient({});

    await expect(
      anonymous.requestNotificationEmailCode({ email: "ada@example.com" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.confirmNotificationEmailCode({ code: "123456" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setEmailChallenge).not.toHaveBeenCalled();
  });
});
