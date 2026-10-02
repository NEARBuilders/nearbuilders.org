import { describe, expect, it, vi } from "vitest";
import {
  claimTelegramLink,
  createTelegramLinkCode,
  hashLinkCode,
  requireAdminKeyOwner,
  reviewerLabel,
} from "../../src/services/telegram-link";

const ADMIN = {
  userId: "user-admin",
  user: { name: "Admin", role: "admin" },
  near: { primaryAccountId: "admin.near" },
} as never;

function setup() {
  const client = {
    createTelegramLinkCode: vi.fn(async () => ({ expiresAt: "2026-09-30T08:10:00.000Z" })),
    linkTelegramReviewer: vi.fn(async () => ({
      data: {
        telegramId: 111,
        telegramUsername: "saad",
        telegramName: "Saad",
        userId: "user-admin",
        userLabel: "admin.near",
        linkedAt: "2026-09-30T08:00:00.000Z",
      },
    })),
  };
  return { client, plugins: { proposals: () => client } as never };
}

describe("createTelegramLinkCode", () => {
  it("issues a code to the signed-in admin and stores only its hash", async () => {
    const { client, plugins } = setup();
    const result = await createTelegramLinkCode(plugins, ADMIN, { botUsername: "" });

    expect(result.code).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(result).toMatchObject({
      command: `/link ${result.code}`,
      expiresAt: "2026-09-30T08:10:00.000Z",
      openUrl: null,
    });
    expect(client.createTelegramLinkCode).toHaveBeenCalledWith({
      codeHash: hashLinkCode(result.code),
      userId: "user-admin",
      userLabel: "admin.near",
      ttlMs: 600_000,
    });
  });

  it("adds a Telegram deep link that fits the start parameter limit", async () => {
    const { plugins } = setup();
    const result = await createTelegramLinkCode(plugins, ADMIN, { botUsername: "ChiefBot" });
    const start = new URL(result.openUrl!).searchParams.get("start")!;
    expect(result.openUrl).toBe(`https://t.me/ChiefBot?start=link-${result.code}`);
    expect(start.length).toBeLessThanOrEqual(64);
  });

  it("requires a signed-in user", async () => {
    const { plugins } = setup();
    await expect(createTelegramLinkCode(plugins, {} as never, { botUsername: "" })).rejects.toThrow(
      "Authentication required",
    );
  });
});

describe("claimTelegramLink", () => {
  it("links the Telegram sender to the admin who issued the code", async () => {
    const { client, plugins } = setup();
    await expect(
      claimTelegramLink(plugins, { code: "plain-code", telegramId: 111, username: "saad" }),
    ).resolves.toEqual({ userLabel: "admin.near" });
    expect(client.linkTelegramReviewer).toHaveBeenCalledWith({
      codeHash: hashLinkCode("plain-code"),
      telegramId: 111,
      telegramUsername: "saad",
      telegramName: null,
    });
  });
});

describe("requireAdminKeyOwner", () => {
  it("accepts only API keys owned by an admin account", () => {
    expect(() => requireAdminKeyOwner(ADMIN)).not.toThrow();
    expect(() =>
      requireAdminKeyOwner({ userId: "u1", user: { role: "user" }, apiKey: { id: "k" } } as never),
    ).toThrow("must belong to a nearbuilders.org admin account");
    expect(() => requireAdminKeyOwner({ apiKey: { id: "k" } } as never)).toThrow();
  });
});

describe("reviewerLabel", () => {
  it("falls back from NEAR account to display name to user id", () => {
    expect(reviewerLabel({ userId: "u1", user: { name: "Admin" } } as never)).toBe("Admin");
    expect(reviewerLabel({ userId: "u1" } as never)).toBe("u1");
  });
});
