import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabaseDriver } from "../db";
import { builderNominations } from "../db/schema";
import Plugin from "../index";
import {
  createNominationToken,
  hashNominationToken,
  type TelegramNominationInput,
} from "../services/builders";

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
  const files = [
    "0000_large_power_man.sql",
    "0001_grey_prodigy.sql",
    "0002_chunky_roxanne_simpson.sql",
  ];
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
        TELEGRAM_BOT_API_KEY_ID: "telegram-bot-key",
      },
    });
  }, 30_000);

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  function botClient(apiKeyId = "telegram-bot-key") {
    return loaded.createClient({
      apiKey: {
        id: apiKeyId,
        name: "Telegram bot",
        permissions: {},
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

  function joinToken(
    response: Awaited<ReturnType<ReturnType<typeof botClient>["createTelegramNomination"]>>,
  ) {
    expect(response.body.status).toBe("awaiting_profile");
    if (response.body.status !== "awaiting_profile" || !response.body.joinUrl) {
      throw new Error("Expected an onboarding handoff");
    }
    return new URL(response.body.joinUrl).searchParams.get("nomination")!;
  }

  it("creates a stable verified nomination and replays the source idempotently", async () => {
    const first = await botClient().createTelegramNomination(createInput());
    const second = await botClient().createTelegramNomination(createInput());
    const token = joinToken(first);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(first.body).toMatchObject({
      status: "awaiting_profile",
      proposalId: null,
      proposalEntityId: null,
    });
    expect(first.body.nominationId).toMatch(/^nom_/);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(first.headers).toMatchObject({ "cache-control": "no-store" });
  });

  it("deduplicates concurrent numeric-ID nominations without changing attribution", async () => {
    const firstInput = {
      ...baseNomination,
      sourceNominationId: "100",
      nomineeTelegramId: 1000,
      nominatedByTelegramId: 700,
    };
    const secondInput = {
      ...firstInput,
      sourceNominationId: "101",
      nominatedByTelegramId: 701,
    };
    const responses = await Promise.all([
      botClient().createTelegramNomination(createInput(firstInput)),
      botClient().createTelegramNomination(createInput(secondInput)),
    ]);

    expect(new Set(responses.map((response) => response.body.nominationId)).size).toBe(1);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
  });

  it("rejects conflicting concurrent reuse of one Telegram update ID", async () => {
    const nomination = {
      ...baseNomination,
      sourceNominationId: "105",
      nomineeTelegramId: 1050,
    };
    const results = await Promise.allSettled([
      botClient().createTelegramNomination(createInput(nomination)),
      botClient().createTelegramNomination(createInput({ ...nomination, nomineeTelegramId: 1051 })),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected?.reason).toBeInstanceOf(Error);
    expect(String(rejected?.reason)).toContain("different data");
  });

  it("creates one unresolved claim per normalized username and no token before verification", async () => {
    const firstInput = {
      ...baseNomination,
      sourceNominationId: "110",
      nomineeTelegramId: null,
      nomineeUsername: "Pending_Alice",
    };
    const secondInput = {
      ...firstInput,
      sourceNominationId: "111",
      nomineeUsername: "pending_alice",
    };
    const first = await botClient().createTelegramNomination(createInput(firstInput));
    const second = await botClient().createTelegramNomination(createInput(secondInput));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.nominationId).toBe(first.body.nominationId);
    expect(first.body).toEqual({
      nominationId: first.body.nominationId,
      status: "awaiting_claim",
      proposalId: null,
      proposalEntityId: null,
    });
  });

  it("claims a deep link case-insensitively and repeats the claim idempotently", async () => {
    const created = await botClient().createTelegramNomination(
      createInput({
        ...baseNomination,
        sourceNominationId: "120",
        nomineeTelegramId: null,
        nomineeUsername: "ClaimMe",
      }),
    );
    const claim = {
      nominationId: created.body.nominationId,
      nomineeTelegramId: 1200,
      nomineeUsername: "claimme",
    };
    await expect(
      botClient().claimTelegramNomination({ ...claim, nomineeUsername: "renamed_before_claim" }),
    ).rejects.toThrow("does not belong");
    const first = await botClient().claimTelegramNomination(claim);
    const second = await botClient().claimTelegramNomination({
      ...claim,
      nomineeUsername: "ClaimMeRenamed",
    });

    expect(first.status).toBe("awaiting_profile");
    expect(second).toEqual({ ...first, joinUrl: first.joinUrl });
    expect(first.joinUrl).toBe(second.joinUrl);
    await expect(
      botClient().claimTelegramNomination({ ...claim, nomineeTelegramId: 1201 }),
    ).rejects.toThrow("does not belong");
  });

  it("plain start prefers the numeric ID and releases its pending username handle", async () => {
    const canonical = await botClient().createTelegramNomination(
      createInput({
        ...baseNomination,
        sourceNominationId: "130",
        nomineeTelegramId: 1300,
        nomineeUsername: "original_name",
      }),
    );
    const pending = await botClient().createTelegramNomination(
      createInput({
        ...baseNomination,
        sourceNominationId: "131",
        nomineeTelegramId: null,
        nomineeUsername: "new_name",
      }),
    );

    const plain = await botClient().claimTelegramNomination({
      nomineeTelegramId: 1300,
      nomineeUsername: "new_name",
    });
    expect(plain.nominationId).toBe(canonical.body.nominationId);

    const replacement = await botClient().createTelegramNomination(
      createInput({
        ...baseNomination,
        sourceNominationId: "132",
        nomineeTelegramId: null,
        nomineeUsername: "NEW_NAME",
      }),
    );
    expect(replacement.status).toBe(201);
    expect(replacement.body.nominationId).not.toBe(pending.body.nominationId);

    const deep = await botClient().claimTelegramNomination({
      nominationId: pending.body.nominationId,
      nomineeTelegramId: 1300,
      nomineeUsername: "new_name",
    });
    expect(deep.nominationId).toBe(canonical.body.nominationId);
    expect(deep.joinUrl).toBe(plain.joinUrl);
  });

  it("plain start claims an exact pending username and distinguishes not found", async () => {
    const created = await botClient().createTelegramNomination(
      createInput({
        ...baseNomination,
        sourceNominationId: "140",
        nomineeTelegramId: null,
        nomineeUsername: "PlainStart",
      }),
    );
    const claimed = await botClient().claimTelegramNomination({
      nomineeTelegramId: 1400,
      nomineeUsername: "plainstart",
    });

    expect(claimed.nominationId).toBe(created.body.nominationId);
    expect(claimed.status).toBe("awaiting_profile");
    await expect(
      botClient().claimTelegramNomination({
        nomineeTelegramId: 1401,
        nomineeUsername: "missing",
      }),
    ).rejects.toThrow("Nomination not found");
  });

  it("rejects source-id reuse with a different identity or attribution", async () => {
    const nomination = { ...baseNomination, sourceNominationId: "150", nomineeTelegramId: 1500 };
    await botClient().createTelegramNomination(createInput(nomination));

    await expect(
      botClient().createTelegramNomination(createInput({ ...nomination, nomineeTelegramId: 1501 })),
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

  it("keeps public token resolution identity-free and finalizes idempotently", async () => {
    const created = await botClient().createTelegramNomination(
      createInput({ ...baseNomination, sourceNominationId: "160", nomineeTelegramId: 1600 }),
    );
    const token = joinToken(created);

    await expect(botClient().resolveTelegramNomination({ token })).resolves.toEqual({
      status: "ready",
      nominationId: created.body.nominationId,
      source: "telegram",
    });
    const alice = builderClient("alice-owner", "alice-owner.near");
    await expect(
      alice.finalizeTelegramNomination({ token, proposalId: "prop_owner" }),
    ).resolves.toEqual({ nominationId: created.body.nominationId, source: "telegram" });
    await expect(
      alice.finalizeTelegramNomination({ token, proposalId: "prop_owner" }),
    ).resolves.toMatchObject({ nominationId: created.body.nominationId });
    await expect(
      builderClient("bob-owner", "bob-owner.near").finalizeTelegramNomination({
        token,
        proposalId: "prop_owner",
      }),
    ).rejects.toThrow("another builder");
    await expect(botClient().resolveTelegramNomination({ token })).resolves.toEqual({
      status: "submitted",
      nominationId: created.body.nominationId,
      source: "telegram",
    });
  });

  it("stores attribution and only token hashes after Telegram verification", async () => {
    const isolatedRuntime = createPluginRuntime({ registry: { builders: { module: Plugin } } });
    const isolatedDir = await mkdtemp(join(tmpdir(), "nearbuilders-token-hash-"));
    const isolated = await isolatedRuntime.usePlugin("builders", {
      variables: { nominationJoinBaseUrl: "https://nearbuilders.org" },
      secrets: {
        BUILDERS_DATABASE_URL: `pglite:${isolatedDir}`,
        NOMINATION_TOKEN_SECRET: "test-only-nomination-token-secret-value",
        TELEGRAM_BOT_API_KEY_ID: "telegram-bot-key",
      },
    });
    const client = isolated.createClient({
      apiKey: { id: "telegram-bot-key", name: "Telegram bot", permissions: {} },
    });
    const response = await client.createTelegramNomination(
      createInput({
        ...baseNomination,
        sourceNominationId: "170",
        nomineeTelegramId: null,
        nomineeUsername: "StoredPending",
      }),
    );
    const claimed = await client.claimTelegramNomination({
      nominationId: response.body.nominationId,
      nomineeTelegramId: 1700,
      nomineeUsername: "storedpending",
    });
    if (!claimed.joinUrl) throw new Error("Expected join URL");
    const token = new URL(claimed.joinUrl).searchParams.get("nomination")!;

    await isolatedRuntime.shutdown();
    const driver = await createDatabaseDriver(`pglite:${isolatedDir}`);
    const [stored] = await driver.db.select().from(builderNominations).limit(1);

    expect(stored).toMatchObject({
      nomineeTelegramId: 1700,
      nomineeUsername: "storedpending",
      nominatedByTelegramId: 456,
      telegramGroupId: -100789,
      createdByApiKeyId: "telegram-bot-key",
      tokenHash: hashNominationToken(token),
      unresolvedUsernameNormalized: null,
    });
    expect(stored?.tokenHash).not.toBe(token);

    await driver.close();
    await rm(isolatedDir, { recursive: true, force: true });
  });

  it("upgrades legacy duplicates into one canonical nomination without breaking old tokens", async () => {
    const migrationDir = await mkdtemp(join(tmpdir(), "nearbuilders-builders-migration-"));
    const databaseUrl = `pglite:${migrationDir}`;
    const tokenSecret = "test-only-nomination-token-secret-value";
    const canonicalId = "nom_legacy_canonical";
    const duplicateId = "nom_legacy_duplicate";
    const canonicalToken = createNominationToken(tokenSecret, canonicalId);
    const duplicateToken = createNominationToken(tokenSecret, duplicateId);
    const legacyDriver = await createDatabaseDriver(databaseUrl);

    for (const file of ["0000_large_power_man.sql", "0001_grey_prodigy.sql"]) {
      const source = await readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8");
      for (const statement of source
        .split("--> statement-breakpoint")
        .map((value) => value.trim())
        .filter(Boolean)) {
        await legacyDriver.db.execute(sql.raw(statement));
      }
    }

    await legacyDriver.db.execute(sql`
      INSERT INTO builder_nominations (
        id,
        source,
        source_nomination_id,
        nominee_telegram_id,
        nominee_username,
        nominated_by_telegram_id,
        telegram_group_id,
        created_by_api_key_id,
        token_hash,
        created_at
      ) VALUES (
        ${canonicalId},
        'telegram',
        '900',
        1900,
        'LegacyName',
        500,
        -100500,
        'telegram-bot-key',
        ${hashNominationToken(canonicalToken)},
        '2026-01-01T00:00:00.000Z'
      )
    `);
    await legacyDriver.db.execute(sql`
      INSERT INTO builder_nominations (
        id,
        source,
        source_nomination_id,
        nominee_telegram_id,
        nominee_username,
        nominated_by_telegram_id,
        telegram_group_id,
        created_by_api_key_id,
        token_hash,
        created_at,
        proposal_id,
        submitted_near_account,
        submitted_user_id,
        submitted_at
      ) VALUES (
        ${duplicateId},
        'telegram',
        '901',
        1900,
        'legacyname',
        501,
        -100501,
        'telegram-bot-key',
        ${hashNominationToken(duplicateToken)},
        '2026-01-02T00:00:00.000Z',
        'proposal_legacy',
        'legacy.near',
        'legacy-user',
        '2026-01-03T00:00:00.000Z'
      )
    `);
    await legacyDriver.close();

    const migrationRuntime = createPluginRuntime({ registry: { builders: { module: Plugin } } });
    const migrated = await migrationRuntime.usePlugin("builders", {
      variables: { nominationJoinBaseUrl: "https://nearbuilders.org" },
      secrets: {
        BUILDERS_DATABASE_URL: databaseUrl,
        NOMINATION_TOKEN_SECRET: tokenSecret,
        TELEGRAM_BOT_API_KEY_ID: "telegram-bot-key",
      },
    });
    const client = migrated.createClient({
      apiKey: { id: "telegram-bot-key", name: "Telegram bot", permissions: {} },
    });

    await expect(client.resolveTelegramNomination({ token: duplicateToken })).resolves.toEqual({
      status: "submitted",
      nominationId: canonicalId,
      source: "telegram",
    });
    const replay = await client.createTelegramNomination(
      createInput({
        ...baseNomination,
        sourceNominationId: "902",
        nomineeTelegramId: 1900,
        nomineeUsername: "CurrentName",
        nominatedByTelegramId: 502,
      }),
    );
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      nominationId: canonicalId,
      status: "submitted",
      proposalId: "proposal_legacy",
      proposalEntityId: "legacy.near",
    });

    await migrationRuntime.shutdown();
    const migratedDriver = await createDatabaseDriver(databaseUrl);
    const rows = await migratedDriver.db.select().from(builderNominations);
    const canonical = rows.find((row) => row.id === canonicalId);
    const duplicate = rows.find((row) => row.id === duplicateId);

    expect(rows.filter((row) => row.nomineeTelegramId === 1900)).toHaveLength(1);
    expect(canonical).toMatchObject({
      sourceNomineeTelegramId: 1900,
      nomineeTelegramId: 1900,
      nominatedByTelegramId: 500,
      canonicalNominationId: null,
      proposalId: "proposal_legacy",
      submittedNearAccount: "legacy.near",
      submittedUserId: "legacy-user",
    });
    expect(duplicate).toMatchObject({
      sourceNomineeTelegramId: 1900,
      nomineeTelegramId: null,
      canonicalNominationId: canonicalId,
      tokenHash: hashNominationToken(duplicateToken),
    });

    await migratedDriver.close();
    await rm(migrationDir, { recursive: true, force: true });
  }, 30_000);

  it("allowlists the configured bot key and validates idempotency headers", async () => {
    await expect(
      loaded
        .createClient({})
        .createTelegramNomination(
          createInput({ ...baseNomination, sourceNominationId: "180", nomineeTelegramId: 1800 }),
        ),
    ).rejects.toThrow("API key required");
    await expect(
      botClient("other-key").createTelegramNomination(
        createInput({ ...baseNomination, sourceNominationId: "181", nomineeTelegramId: 1801 }),
      ),
    ).rejects.toThrow("cannot manage Telegram nominations");
    await expect(
      botClient("other-key").claimTelegramNomination({
        nomineeTelegramId: 1801,
        nomineeUsername: null,
      }),
    ).rejects.toThrow("cannot manage Telegram nominations");
    await expect(
      botClient().claimTelegramNomination({ nomineeTelegramId: 1801, nomineeUsername: null }),
    ).rejects.toThrow("Nomination not found");
    await expect(
      botClient().createTelegramNomination({
        headers: { "idempotency-key": "telegram-nomination:183" },
        body: {
          ...baseNomination,
          sourceNominationId: "183",
          nomineeTelegramId: null,
          nomineeUsername: null,
        },
      } as never),
    ).rejects.toThrow();
    await expect(
      botClient().createTelegramNomination(
        createInput(
          { ...baseNomination, sourceNominationId: "182", nomineeTelegramId: 1802 },
          "telegram-nomination:wrong",
        ),
      ),
    ).rejects.toThrow("Invalid idempotency-key");
  });
});
