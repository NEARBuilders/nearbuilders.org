import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it } from "vitest";
import CreditsPlugin from "@/index";

function userContext(role: "admin" | "member" = "member") {
  return {
    userId: `${role}-user`,
    user: {
      id: `${role}-user`,
      name: role,
      email: `${role}-user@example.com`,
      emailVerified: true,
      image: null,
      role,
      isAnonymous: false,
    },
    near: { primaryAccountId: null, linkedAccounts: [], hasNearAccount: false },
    reqHeaders: new Headers(),
  };
}

describe("Credit settings", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadCredits() {
    const runtime = createPluginRuntime({ registry: { credits: { module: CreditsPlugin } } });
    runtimes.push(runtime);
    const loaded = await runtime.usePlugin(
      "credits",
      { variables: {}, secrets: { CREDITS_DATABASE_URL: "pglite::memory:" } },
      { builders: {} },
    );
    return {
      admin: loaded.createClient(userContext("admin") as never),
      member: loaded.createClient(userContext("member") as never),
    };
  }

  it("starts empty and persists an updated configuration with audit stamps", async () => {
    const { admin } = await loadCredits();

    await expect(admin.getCreditSettings({})).resolves.toEqual({ settings: null });

    const saved = await admin.updateCreditSettings({
      enabled: true,
      amountUsd: 5,
      claimsCloseAt: "2999-01-01T00:00:00Z",
      keyExpiresAt: "2999-02-01T00:00:00Z",
      nearAiWorkspaceId: "ws-hackathon",
      nearAiLoginAccountId: "nearbuilding.near",
    });

    expect(saved.settings).toEqual({
      enabled: true,
      amountUsd: 5,
      claimsCloseAt: "2999-01-01T00:00:00.000Z",
      keyExpiresAt: "2999-02-01T00:00:00.000Z",
      nearAiWorkspaceId: "ws-hackathon",
      nearAiLoginAccountId: "nearbuilding.near",
      updatedBy: "admin-user",
      updatedAt: expect.any(String),
    });

    await expect(admin.getCreditSettings({})).resolves.toEqual(saved);

    const overwritten = await admin.updateCreditSettings({
      enabled: false,
      amountUsd: 2.5,
      claimsCloseAt: null,
      keyExpiresAt: null,
      nearAiWorkspaceId: "ws-2",
      nearAiLoginAccountId: "",
    });
    expect(overwritten.settings).toMatchObject({
      enabled: false,
      amountUsd: 2.5,
      claimsCloseAt: null,
      keyExpiresAt: null,
      nearAiWorkspaceId: "ws-2",
    });
    await expect(admin.getCreditSettings({})).resolves.toEqual(overwritten);
  });

  it("rejects invalid configurations with the offending fields", async () => {
    const { admin } = await loadCredits();

    await expect(
      admin.updateCreditSettings({
        enabled: true,
        amountUsd: 5.011,
        claimsCloseAt: "2999-01-01T00:00:00Z",
        keyExpiresAt: "2999-02-01T00:00:00Z",
        nearAiWorkspaceId: "ws",
        nearAiLoginAccountId: "",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      admin.updateCreditSettings({
        enabled: true,
        amountUsd: 5,
        claimsCloseAt: "2999-02-01T00:00:00Z",
        keyExpiresAt: "2999-01-01T00:00:00Z",
        nearAiWorkspaceId: "ws",
        nearAiLoginAccountId: "",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Key expiry must be after claims close",
    });

    await expect(
      admin.updateCreditSettings({
        enabled: true,
        amountUsd: 5,
        claimsCloseAt: "not-a-date",
        keyExpiresAt: "2999-01-01T00:00:00Z",
        nearAiWorkspaceId: "ws",
        nearAiLoginAccountId: "",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(admin.getCreditSettings({})).resolves.toEqual({ settings: null });
  });

  it("keeps settings away from members", async () => {
    const { admin, member } = await loadCredits();

    await expect(member.getCreditSettings({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      member.updateCreditSettings({
        enabled: true,
        amountUsd: 1,
        claimsCloseAt: null,
        keyExpiresAt: null,
        nearAiWorkspaceId: "ws",
        nearAiLoginAccountId: "",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(admin.getCreditSettings({})).resolves.toEqual({ settings: null });
  });
});
