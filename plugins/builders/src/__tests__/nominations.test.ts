import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabaseDriver } from "../db";
import { builderNominations } from "../db/schema";
import Plugin from "../index";
import { hashNominationToken, type TelegramNominationInput } from "../services/builders";

function testNear(primaryAccountId: string) {
  return { primaryAccountId, linkedAccounts: [], hasNearAccount: true };
}

function testUser(id: string) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    role: "member",
    isAnonymous: false,
  };
}

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const files = ["0000_large_power_man.sql", "0001_grey_prodigy.sql"];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1785400000000 + index,
      hash: `builders-nomination-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe.sequential("Telegram builder nominations", () => {
  const runtime = createPluginRuntime({ registry: { builders: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"builders">>>;

  const baseNomination: TelegramNominationInput = {
    source: "telegram",
    sourceNominationId: "42",
    nomineeTelegramId: 123,
    nomineeUsername: "alice",
    nominatedByTelegramId: 456,
    telegramGroupId: -100789,
  };

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-builders-plugin-"));
    loaded = await runtime.usePlugin("builders", {
      variables: {
        nominationJoinBaseUrl: "https://nearbuilders.org",
      },
      secrets: {
        BUILDERS_DATABASE_URL: `pglite:${dataDir}`,
        NOMINATION_TOKEN_SECRET: "test-only-nomination-token-secret-value",
      },
    });
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  function botClient(apiKeyId = "telegram-bot-key", permissions: Record<string, string[]> = {}) {
    return loaded.createClient({
      apiKey: {
        id: apiKeyId,
        name: "Telegram bot",
        permissions,
      },
    });
  }

  function builderClient(userId: string, nearAccount: string) {
    return loaded.createClient({
      userId,
      user: testUser(userId),
      near: testNear(nearAccount),
    });
  }

  function createInput(
    nomination = baseNomination,
    idempotencyKey = `telegram-nomination:${nomination.sourceNominationId}`,
  ) {
    return {
      headers: {
        "idempotency-key": idempotencyKey,
      },
      body: nomination,
    };
  }

  it("creates a stable HTTPS nomination handoff without an expiry", async () => {
    const first = await botClient().createTelegramNomination(createInput());
    const second = await botClient().createTelegramNomination(createInput());
    const joinUrl = new URL(first.body.joinUrl);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(Object.keys(first.body).sort()).toEqual(["joinUrl", "nominationId"]);
    expect(first.body.nominationId).toMatch(/^nom_/);
    expect(joinUrl.protocol).toBe("https:");
    expect(joinUrl.pathname).toBe("/join");
    expect(joinUrl.searchParams.get("nomination")).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(first.headers).toMatchObject({
      "cache-control": "no-store",
    });
  });

  it("updates mutable usernames but rejects immutable Telegram identity conflicts", async () => {
    const nomination = { ...baseNomination, sourceNominationId: "44" };
    const first = await botClient().createTelegramNomination(createInput(nomination));
    const renamed = await botClient().createTelegramNomination(
      createInput({ ...nomination, nomineeUsername: "alice_new" }),
    );

    expect(renamed.body).toEqual(first.body);
    await expect(
      botClient().createTelegramNomination(createInput({ ...nomination, nomineeTelegramId: 999 })),
    ).rejects.toThrow("different data");
    await expect(
      botClient().createTelegramNomination(
        createInput({ ...nomination, nominatedByTelegramId: 999 }),
      ),
    ).rejects.toThrow("different data");
    await expect(
      botClient().createTelegramNomination(
        createInput({ ...nomination, telegramGroupId: -100999 }),
      ),
    ).rejects.toThrow("different data");
  });

  it("resolves ready, invalid, and submitted tokens", async () => {
    const nomination = { ...baseNomination, sourceNominationId: "45" };
    const created = await botClient().createTelegramNomination(createInput(nomination));
    const token = new URL(created.body.joinUrl).searchParams.get("nomination")!;

    await expect(botClient().resolveTelegramNomination({ token })).resolves.toEqual({
      status: "ready",
      nominationId: created.body.nominationId,
      source: "telegram",
    });
    await expect(botClient().resolveTelegramNomination({ token: "x".repeat(48) })).resolves.toEqual(
      { status: "invalid" },
    );
    await expect(botClient().resolveTelegramNomination({ token: "short" })).resolves.toEqual({
      status: "invalid",
    });

    await builderClient("alice-user", "alice.near").finalizeTelegramNomination({
      token,
      proposalId: "prop_alice",
    });

    await expect(botClient().resolveTelegramNomination({ token })).resolves.toEqual({
      status: "submitted",
      nominationId: created.body.nominationId,
      source: "telegram",
    });
  });

  it("finalizes idempotently for one proposal owner and rejects conflicts", async () => {
    const nomination = { ...baseNomination, sourceNominationId: "46" };
    const created = await botClient().createTelegramNomination(createInput(nomination));
    const token = new URL(created.body.joinUrl).searchParams.get("nomination")!;
    const alice = builderClient("alice-owner", "alice-owner.near");

    await expect(
      alice.finalizeTelegramNomination({ token, proposalId: "prop_owner" }),
    ).resolves.toEqual({
      nominationId: created.body.nominationId,
      source: "telegram",
    });
    await expect(
      alice.finalizeTelegramNomination({ token, proposalId: "prop_owner" }),
    ).resolves.toMatchObject({ nominationId: created.body.nominationId });
    await expect(
      alice.finalizeTelegramNomination({ token, proposalId: "prop_other" }),
    ).rejects.toThrow("another builder");
    await expect(
      builderClient("bob-owner", "bob-owner.near").finalizeTelegramNomination({
        token,
        proposalId: "prop_owner",
      }),
    ).rejects.toThrow("another builder");
  });

  it("serializes concurrent duplicate creation into one stable handoff", async () => {
    const nomination = { ...baseNomination, sourceNominationId: "47" };
    const responses = await Promise.all([
      botClient().createTelegramNomination(createInput(nomination)),
      botClient().createTelegramNomination(createInput(nomination)),
    ]);

    expect(new Set(responses.map((response) => response.body.nominationId)).size).toBe(1);
    expect(new Set(responses.map((response) => response.body.joinUrl)).size).toBe(1);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
  });

  it("stores attribution and only the secure hash of the bearer token", async () => {
    const isolatedRuntime = createPluginRuntime({
      registry: { builders: { module: Plugin } },
    });
    const isolatedDir = await mkdtemp(join(tmpdir(), "nearbuilders-token-hash-"));
    const isolated = await isolatedRuntime.usePlugin("builders", {
      variables: {
        nominationJoinBaseUrl: "https://nearbuilders.org",
      },
      secrets: {
        BUILDERS_DATABASE_URL: `pglite:${isolatedDir}`,
        NOMINATION_TOKEN_SECRET: "test-only-nomination-token-secret-value",
      },
    });
    const nomination = { ...baseNomination, sourceNominationId: "48" };
    const response = await isolated
      .createClient({
        apiKey: {
          id: "hash-test-key",
          name: "Hash test",
          permissions: {},
        },
      })
      .createTelegramNomination(createInput(nomination));
    const token = new URL(response.body.joinUrl).searchParams.get("nomination")!;

    await isolatedRuntime.shutdown();
    const driver = await createDatabaseDriver(`pglite:${isolatedDir}`);
    const [stored] = await driver.db.select().from(builderNominations).limit(1);

    expect(stored).toMatchObject({
      nomineeUsername: "alice",
      nomineeTelegramId: 123,
      nominatedByTelegramId: 456,
      telegramGroupId: -100789,
      createdByApiKeyId: "hash-test-key",
      tokenHash: hashNominationToken(token),
    });
    expect(stored?.tokenHash).not.toBe(token);

    await driver.close();
    await rm(isolatedDir, { recursive: true, force: true });
  });

  it("requires an API key, accepts every key, and validates idempotency headers", async () => {
    await expect(
      loaded
        .createClient({})
        .createTelegramNomination(createInput({ ...baseNomination, sourceNominationId: "49" })),
    ).rejects.toThrow("API key required");

    await expect(
      loaded
        .createClient({
          apiKey: {
            id: "read-only-key",
            name: "Read only",
            permissions: { builders: ["read"] },
          },
        })
        .createTelegramNomination(createInput({ ...baseNomination, sourceNominationId: "50" })),
    ).resolves.toMatchObject({ status: 201 });

    await expect(
      botClient("empty-permissions-key").createTelegramNomination(
        createInput({ ...baseNomination, sourceNominationId: "51" }),
      ),
    ).resolves.toMatchObject({ status: 201 });

    await expect(
      botClient().createTelegramNomination(
        createInput({ ...baseNomination, sourceNominationId: "52" }, "telegram-nomination:wrong"),
      ),
    ).rejects.toThrow("Invalid idempotency-key");
  });
});
