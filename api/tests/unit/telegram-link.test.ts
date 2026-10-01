import { describe, expect, it, vi } from "vitest";
import {
  confirmTelegramLink,
  createTelegramLink,
  hashLinkCode,
  previewTelegramLink,
  reviewerLabel,
  TELEGRAM_LINK_PATH,
} from "../../src/services/telegram-link";

const ADMIN = { userId: "user-admin", user: { name: "Admin" } } as never;

const REVIEWER = {
  telegramId: 111,
  telegramUsername: "saad",
  telegramName: "Saad",
  userId: "user-admin",
  userLabel: "admin.near",
  linkedAt: "2026-09-30T08:00:00.000Z",
};

function setup(
  options: { pendingCode?: boolean; linked?: boolean; ownLink?: typeof REVIEWER | null } = {},
) {
  const client = {
    createTelegramLinkCode: vi.fn(async () => ({ expiresAt: "2026-09-30T08:10:00.000Z" })),
    getTelegramLinkCode: vi.fn(async () => ({
      data:
        options.pendingCode === false
          ? null
          : {
              telegramId: 111,
              telegramUsername: "saad",
              telegramName: "Saad",
              expiresAt: "2026-09-30T08:10:00.000Z",
            },
    })),
    getTelegramReviewer: vi.fn(async () => ({ data: options.linked ? REVIEWER : null })),
    getTelegramReviewerByUser: vi.fn(async () => ({ data: options.ownLink ?? null })),
    linkTelegramReviewer: vi.fn(async () => ({ data: REVIEWER })),
  };
  return { client, plugins: { proposals: () => client } as never };
}

describe("createTelegramLink", () => {
  it("stores only the hash of a fresh code and returns the admin page path", async () => {
    const { client, plugins } = setup();
    const result = await createTelegramLink(plugins, {
      telegramId: 111,
      username: "saad",
      name: "Saad",
    });

    const code = new URL(result.path, "https://nearbuilders.org").searchParams.get("code")!;
    expect(result.path.startsWith(`${TELEGRAM_LINK_PATH}?code=`)).toBe(true);
    expect(code.length).toBeGreaterThanOrEqual(40);
    expect(client.createTelegramLinkCode).toHaveBeenCalledWith({
      codeHash: hashLinkCode(code),
      telegramId: 111,
      telegramUsername: "saad",
      telegramName: "Saad",
      ttlMs: 600_000,
    });
    expect(result).toEqual({
      path: result.path,
      expiresAt: "2026-09-30T08:10:00.000Z",
      alreadyLinked: false,
    });
  });

  it("reports an existing link without revealing which admin it belongs to", async () => {
    const { plugins } = setup({ linked: true });
    const result = await createTelegramLink(plugins, { telegramId: 111 });
    expect(result.alreadyLinked).toBe(true);
    expect(JSON.stringify(result)).not.toContain("admin.near");
  });
});

describe("previewTelegramLink", () => {
  it("describes the Telegram account behind a valid code", async () => {
    const { client, plugins } = setup({ linked: true });
    const otherAdmin = { userId: "user-other", user: { name: "Other" } } as never;
    await expect(previewTelegramLink(plugins, "plain-code", otherAdmin)).resolves.toEqual({
      telegramId: 111,
      telegramUsername: "saad",
      telegramName: "Saad",
      expiresAt: "2026-09-30T08:10:00.000Z",
      linkedAs: "admin.near",
      replaces: null,
    });
    expect(client.getTelegramLinkCode).toHaveBeenCalledWith({
      codeHash: hashLinkCode("plain-code"),
    });
  });

  it("refuses an unknown or expired code", async () => {
    const { plugins } = setup({ pendingCode: false });
    await expect(previewTelegramLink(plugins, "plain-code", ADMIN)).rejects.toThrow("expired");
  });

  it("warns when confirming would replace the admin's link to another Telegram account", async () => {
    const { client, plugins } = setup({
      ownLink: { ...REVIEWER, telegramId: 999, telegramUsername: "old_phone" },
    });
    const preview = await previewTelegramLink(plugins, "plain-code", ADMIN);
    expect(preview.replaces).toEqual({
      telegramId: 999,
      telegramUsername: "old_phone",
      telegramName: "Saad",
    });
    expect(client.getTelegramReviewerByUser).toHaveBeenCalledWith({ userId: "user-admin" });
  });

  it("does not warn when the admin is re-linking the same Telegram account", async () => {
    const { plugins } = setup({ linked: true, ownLink: REVIEWER });
    const preview = await previewTelegramLink(plugins, "plain-code", ADMIN);
    expect(preview.replaces).toBeNull();
    expect(preview.linkedAs).toBeNull();
  });
});

describe("confirmTelegramLink", () => {
  it("links the code to the signed-in admin, labelled by NEAR account", async () => {
    const { client, plugins } = setup();
    await confirmTelegramLink(plugins, "plain-code", {
      userId: "user-admin",
      user: { name: "Admin" },
      near: { primaryAccountId: "admin.near" },
    } as never);
    expect(client.linkTelegramReviewer).toHaveBeenCalledWith({
      codeHash: hashLinkCode("plain-code"),
      userId: "user-admin",
      userLabel: "admin.near",
    });
  });

  it("requires a signed-in user", async () => {
    const { plugins } = setup();
    await expect(confirmTelegramLink(plugins, "plain-code", {} as never)).rejects.toThrow(
      "Authentication required",
    );
  });
});

describe("reviewerLabel", () => {
  it("falls back from NEAR account to display name to user id", () => {
    expect(reviewerLabel({ userId: "u1", user: { name: "Admin" } } as never)).toBe("Admin");
    expect(reviewerLabel({ userId: "u1" } as never)).toBe("u1");
  });
});
