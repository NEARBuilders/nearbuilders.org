import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";
import {
  EMAIL_CODE_COOLDOWN_MS,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_MAX_PER_ADDRESS,
  EMAIL_CODE_MAX_PER_USER,
  EMAIL_CODE_WINDOW_MS,
} from "../services/email-limits";

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const dir = new URL("../db/migrations/", import.meta.url);
  const journal = JSON.parse(await readFile(new URL("meta/_journal.json", dir), "utf8")) as {
    entries: Array<{ idx: number; when: number; tag: string }>;
  };
  return {
    default: await Promise.all(
      journal.entries.map(async (entry) => {
        const source = await readFile(new URL(`${entry.tag}.sql`, dir), "utf8");
        return {
          idx: entry.idx,
          when: entry.when,
          tag: entry.tag,
          hash: `notifications-test-${entry.idx}`,
          sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
        };
      }),
    ),
  };
});

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code: string; data: { retryAfter: number } };
  }
  throw new Error("expected the request to be rejected");
}

function caller(userId: string) {
  return {
    userId,
    user: {
      id: userId,
      name: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      role: "member",
      isAnonymous: false,
      locale: null,
    },
    near: {
      primaryAccountId: userId,
      linkedAccounts: [],
      hasNearAccount: true,
    },
  };
}

describe("notification email verification", () => {
  const runtime = createPluginRuntime({ registry: { notifications: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"notifications">>>;
  const as = (userId: string) => loaded.createClient(caller(userId) as never);
  const asApi = (userId: string) =>
    loaded.createClient({ ...caller(userId), serverNotification: true } as never);
  const clock = { now: Date.now() };

  const advance = (ms: number) => {
    clock.now += ms;
    vi.setSystemTime(clock.now);
  };

  const requestCode = (userId: string, email: string, code: string) =>
    asApi(userId).setEmailChallenge({
      userId,
      pendingEmail: email,
      codeHash: hash(code),
      codeExpiresAt: new Date(clock.now + 15 * 60_000).toISOString(),
    });

  const confirm = (userId: string, code: string) =>
    asApi(userId).confirmEmailCode({ userId, codeHash: hash(code) });

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-notifications-email-"));
    loaded = await runtime.usePlugin("notifications", {
      variables: {},
      secrets: { NOTIFICATIONS_DATABASE_URL: `pglite:${dataDir}` },
    });
    vi.useFakeTimers({ toFake: ["Date"], now: clock.now });
  });

  afterEach(() => {
    advance(2 * EMAIL_CODE_WINDOW_MS);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("applies the email migrations and verifies an address with the right code", async () => {
    await expect(requestCode("ada.near", "ada@example.com", "123456")).resolves.toEqual({
      pendingEmail: "ada@example.com",
    });
    await expect(as("ada.near").getEmailPreference({ userId: "ada.near" })).resolves.toMatchObject({
      email: null,
      verified: false,
      pendingEmail: "ada@example.com",
    });

    await expect(confirm("ada.near", "123456")).resolves.toEqual({
      email: "ada@example.com",
      verified: true,
      enabled: true,
      pendingEmail: null,
    });
  });

  it("rejects a wrong code without verifying", async () => {
    await requestCode("wrong.near", "wrong@example.com", "123456");

    await expect(confirm("wrong.near", "654321")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as("wrong.near").getEmailPreference({ userId: "wrong.near" }),
    ).resolves.toMatchObject({ verified: false, pendingEmail: "wrong@example.com" });
  });

  it("rejects an expired code", async () => {
    await requestCode("late.near", "late@example.com", "123456");
    advance(15 * 60_000 + 1_000);

    await expect(confirm("late.near", "123456")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects confirming without a pending code", async () => {
    await expect(confirm("nothing.near", "123456")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("locks the code after too many wrong guesses, even for the right code", async () => {
    await requestCode("guess.near", "guess@example.com", "123456");

    for (let attempt = 1; attempt <= EMAIL_CODE_MAX_ATTEMPTS; attempt++) {
      await expect(confirm("guess.near", `00000${attempt}`)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }

    await expect(confirm("guess.near", "123456")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      data: { retryAfter: expect.any(Number) },
    });
    await expect(
      as("guess.near").getEmailPreference({ userId: "guess.near" }),
    ).resolves.toMatchObject({ verified: false });
  });

  it("counts concurrent guesses against the same limit", async () => {
    await requestCode("race.near", "race@example.com", "123456");

    const results = await Promise.allSettled(
      Array.from({ length: EMAIL_CODE_MAX_ATTEMPTS * 2 }, (_, index) =>
        confirm("race.near", `10000${index % 10}`),
      ),
    );
    const limited = results.filter(
      (result) => result.status === "rejected" && result.reason?.code === "RATE_LIMITED",
    );

    expect(limited).toHaveLength(EMAIL_CODE_MAX_ATTEMPTS);
    await expect(confirm("race.near", "123456")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("gives a fresh code a fresh set of attempts", async () => {
    await requestCode("fresh.near", "fresh@example.com", "123456");
    for (let attempt = 0; attempt < EMAIL_CODE_MAX_ATTEMPTS; attempt++) {
      await confirm("fresh.near", "000000").catch(() => undefined);
    }
    await expect(confirm("fresh.near", "123456")).rejects.toMatchObject({ code: "RATE_LIMITED" });

    advance(EMAIL_CODE_COOLDOWN_MS + 1_000);
    await requestCode("fresh.near", "fresh@example.com", "222222");

    await expect(confirm("fresh.near", "222222")).resolves.toMatchObject({
      email: "fresh@example.com",
      verified: true,
    });
  });

  it("limits how often a user can request a code", async () => {
    await requestCode("fast.near", "fast@example.com", "123456");
    advance(5_000);

    await expect(requestCode("fast.near", "fast@example.com", "222222")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      data: { retryAfter: expect.any(Number) },
    });
    await expect(confirm("fast.near", "123456")).resolves.toMatchObject({ verified: true });

    const rejected = await rejection(requestCode("fast.near", "other@example.com", "333333"));
    expect(rejected.code).toBe("RATE_LIMITED");
    expect(rejected.data.retryAfter).toBeGreaterThan(0);
    expect(rejected.data.retryAfter).toBeLessThanOrEqual(EMAIL_CODE_COOLDOWN_MS / 1000);

    advance(EMAIL_CODE_COOLDOWN_MS);
    await expect(requestCode("fast.near", "other@example.com", "333333")).resolves.toEqual({
      pendingEmail: "other@example.com",
    });
  });

  it("limits how many codes a user can request per hour", async () => {
    for (let index = 0; index < EMAIL_CODE_MAX_PER_USER; index++) {
      await requestCode("hourly.near", `hourly${index}@example.com`, "123456");
      advance(EMAIL_CODE_COOLDOWN_MS + 1_000);
    }

    const rejected = await rejection(
      requestCode("hourly.near", "hourly-more@example.com", "123456"),
    );
    expect(rejected.code).toBe("RATE_LIMITED");
    expect(rejected.data.retryAfter).toBeGreaterThan(EMAIL_CODE_COOLDOWN_MS / 1000);

    advance(EMAIL_CODE_WINDOW_MS);
    await expect(requestCode("hourly.near", "hourly-more@example.com", "123456")).resolves.toEqual({
      pendingEmail: "hourly-more@example.com",
    });
  });

  it("limits how many codes one address can receive, across users", async () => {
    for (let index = 0; index < EMAIL_CODE_MAX_PER_ADDRESS; index++) {
      const email = index % 2 === 0 ? "target@example.com" : "Target@Example.com";
      await requestCode(`sender${index}.near`, email, "123456");
    }

    await expect(
      requestCode("sender-extra.near", "TARGET@example.com", "123456"),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(
      requestCode("sender-extra.near", "someone-else@example.com", "123456"),
    ).resolves.toEqual({ pendingEmail: "someone-else@example.com" });

    advance(EMAIL_CODE_WINDOW_MS + 1_000);
    await expect(requestCode("sender-late.near", "target@example.com", "123456")).resolves.toEqual({
      pendingEmail: "target@example.com",
    });
  });

  it("keeps address verification behind the API, so a member cannot verify an address they chose", async () => {
    const mallory = as("mallory.near");
    const challenge = {
      userId: "mallory.near",
      pendingEmail: "ceo@example.com",
      codeHash: hash("000000"),
      codeExpiresAt: new Date(clock.now + 60_000).toISOString(),
    };

    await expect(mallory.setEmailChallenge(challenge)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      mallory.confirmEmailCode({ userId: "mallory.near", codeHash: hash("000000") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      mallory.syncVerifiedEmail({ userId: "mallory.near", email: "ceo@example.com" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(mallory.getEmailPreference({ userId: "mallory.near" })).resolves.toMatchObject({
      email: null,
      verified: false,
      pendingEmail: null,
    });
  });

  it("still lets the API sync a verified sign-in email", async () => {
    await expect(
      asApi("synced.near").syncVerifiedEmail({
        userId: "synced.near",
        email: "synced@example.com",
      }),
    ).resolves.toMatchObject({ email: "synced@example.com", verified: true });
  });

  it("still keeps a member's own preference reachable", async () => {
    await expect(
      as("prefs.near").setEmailNotificationsEnabled({ userId: "prefs.near", enabled: false }),
    ).resolves.toMatchObject({ enabled: false });
    await expect(
      as("prefs.near").getEmailPreference({ userId: "other.near" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
