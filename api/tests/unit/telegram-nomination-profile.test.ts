import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiPlugin from "../../src/index";

function proposalResult(input: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    data: {
      id: "prp_telegram_builder",
      pluginId: input.pluginId,
      entityId: input.entityId,
      operation: "create" as const,
      payload: input.payload,
      schemaVersion: "1",
      createdBy: "alice.near",
      reviewStatus: "pending" as const,
      applyStatus: "not_started" as const,
      removeStatus: "not_started" as const,
      rejectionReason: null,
      applyError: null,
      removeError: null,
      appliedResourceId: null,
      submissionCount: 1,
      appliedAt: null,
      removedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function userContext(userId: string, nearAccount: string) {
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
    },
    near: {
      primaryAccountId: nearAccount,
      linkedAccounts: [],
      hasNearAccount: true,
    },
  };
}

function pluginFactories(builders: Record<string, unknown>, proposals: Record<string, unknown>) {
  const emptyClient = () => ({});
  return {
    auth: emptyClient,
    activity: emptyClient,
    apps: emptyClient,
    builders: () => builders,
    events: emptyClient,
    nearcatalog: emptyClient,
    notifications: emptyClient,
    projects: emptyClient,
    proposals: () => proposals,
    votes: emptyClient,
  };
}

describe("Builder profile submission", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadApi(builders: Record<string, unknown>, proposals: Record<string, unknown>) {
    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    return await runtime.usePlugin(
      "api",
      {
        variables: {},
        secrets: { API_DATABASE_URL: "pglite:.bos/api/:memory:" },
      },
      pluginFactories(builders, proposals) as never,
    );
  }

  it("creates the proposal before finalizing a ready nomination", async () => {
    const resolveTelegramNomination = vi.fn(async () => ({
      status: "ready" as const,
      nominationId: "nom_test_relationship",
      source: "telegram" as const,
    }));
    const finalizeTelegramNomination = vi.fn(async () => ({
      nominationId: "nom_test_relationship",
      source: "telegram" as const,
    }));
    const propose = vi.fn(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveTelegramNomination,
        finalizeTelegramNomination,
        getMyBuilderProfile: async () => ({ data: null }),
      },
      { propose },
    );
    const client = loaded.createClient(userContext("alice-user", "alice.near") as never);

    await client.submitBuilderProfile({
      nominationToken: "n".repeat(48),
      name: "Alice",
      bio: "Builds useful things.",
      skills: ["TypeScript"],
      location: "Lisbon",
      links: { website: "https://alice.example.com" },
    });

    expect(resolveTelegramNomination).toHaveBeenCalledWith({ token: "n".repeat(48) });
    expect(propose).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "builders",
        entityId: "alice.near",
        source: "telegram",
        idempotencyKey: "telegram-builder-profile:nom_test_relationship",
        metadata: {
          nominationId: "nom_test_relationship",
          source: "telegram",
        },
      }),
    );
    expect(finalizeTelegramNomination).toHaveBeenCalledWith({
      token: "n".repeat(48),
      proposalId: "prp_telegram_builder",
    });
    expect(propose.mock.invocationCallOrder[0]).toBeLessThan(
      finalizeTelegramNomination.mock.invocationCallOrder[0]!,
    );
  });

  it("leaves a ready nomination unfinalized when proposal creation fails and retries idempotently", async () => {
    const resolveTelegramNomination = vi.fn(async () => ({
      status: "ready" as const,
      nominationId: "nom_retry",
      source: "telegram" as const,
    }));
    const finalizeTelegramNomination = vi.fn(async () => ({
      nominationId: "nom_retry",
      source: "telegram" as const,
    }));
    const propose = vi
      .fn()
      .mockRejectedValueOnce(new Error("proposal unavailable"))
      .mockImplementationOnce(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveTelegramNomination,
        finalizeTelegramNomination,
        getMyBuilderProfile: async () => ({ data: null }),
      },
      { propose },
    );
    const client = loaded.createClient(userContext("retry-user", "retry.near") as never);
    const input = {
      nominationToken: "r".repeat(48),
      name: "Retry",
      bio: "Retries safely.",
      skills: ["Rust"],
    };

    await expect(client.submitBuilderProfile(input)).rejects.toThrow("proposal unavailable");
    expect(finalizeTelegramNomination).not.toHaveBeenCalled();
    await expect(client.submitBuilderProfile(input)).resolves.toMatchObject({
      nominationId: "nom_retry",
      data: { id: "prp_telegram_builder" },
    });
    expect(propose).toHaveBeenCalledTimes(2);
    expect(propose.mock.calls[0]?.[0]).toMatchObject({
      idempotencyKey: "telegram-builder-profile:nom_retry",
    });
    expect(propose.mock.calls[1]?.[0]).toMatchObject({
      idempotencyKey: "telegram-builder-profile:nom_retry",
    });
    expect(finalizeTelegramNomination).toHaveBeenCalledTimes(1);
  });

  it.each([
    "invalid",
    "submitted",
  ] as const)("falls back to public onboarding for a %s nomination token", async (status) => {
    const resolveTelegramNomination = vi.fn(async () =>
      status === "invalid"
        ? { status }
        : { status, nominationId: "nom_used", source: "telegram" as const },
    );
    const finalizeTelegramNomination = vi.fn();
    const propose = vi.fn(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveTelegramNomination,
        finalizeTelegramNomination,
        getMyBuilderProfile: async () => ({ data: null }),
      },
      { propose },
    );
    const client = loaded.createClient(userContext(`${status}-user`, `${status}.near`) as never);

    await expect(
      client.submitBuilderProfile({
        nominationToken: "f".repeat(48),
        name: "Fallback",
        bio: "Uses public onboarding.",
        skills: ["Design"],
      }),
    ).resolves.toMatchObject({ nominationId: null });

    expect(finalizeTelegramNomination).not.toHaveBeenCalled();
    expect(propose).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "web",
      }),
    );
    expect(propose.mock.calls[0]?.[0]).not.toHaveProperty("idempotencyKey");
  });

  it("submits publicly without a nomination and rejects non-HTTP profile links", async () => {
    const resolveTelegramNomination = vi.fn();
    const finalizeTelegramNomination = vi.fn();
    const propose = vi.fn(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveTelegramNomination,
        finalizeTelegramNomination,
        getMyBuilderProfile: async () => ({ data: null }),
      },
      { propose },
    );
    const client = loaded.createClient(userContext("bob-user", "bob.near") as never);

    await expect(
      client.submitBuilderProfile({
        name: "Bob",
        bio: "Ships products.",
        skills: ["Design"],
      }),
    ).resolves.toMatchObject({ nominationId: null });
    await expect(
      client.submitBuilderProfile({
        name: "Bob",
        bio: "Ships products.",
        skills: ["Design"],
        links: { website: "ftp://files.example.com" },
      }),
    ).rejects.toThrow();

    expect(resolveTelegramNomination).not.toHaveBeenCalled();
    expect(finalizeTelegramNomination).not.toHaveBeenCalled();
  });

  it("forwards the bot nomination response without an expiry field", async () => {
    const response = {
      status: 201 as const,
      headers: {
        "cache-control": "no-store",
      },
      body: {
        nominationId: "nom_test_handoff",
        joinUrl: "https://nearbuilders.org/join?nomination=opaque-token-placeholder",
      },
    };
    const createTelegramNomination = vi.fn(async () => response);
    const loaded = await loadApi({ createTelegramNomination }, {});
    const client = loaded.createClient({
      apiKey: {
        id: "telegram-bot-key",
        name: "Telegram bot",
        permissions: {},
      },
    } as never);
    const input = {
      headers: {
        "idempotency-key": "telegram-nomination:42",
      },
      body: {
        source: "telegram" as const,
        sourceNominationId: "42",
        nomineeTelegramId: 123,
        nomineeUsername: null,
        nominatedByTelegramId: 456,
        telegramGroupId: -100789,
      },
    };

    await expect(client.createTelegramNomination(input)).resolves.toEqual(response);
    const handler = new OpenAPIHandler(loaded.router);
    const request = new Request("https://nearbuilders.org/api/builders/nominations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "telegram-nomination:42",
        "x-api-key": "test-api-key-placeholder",
      },
      body: JSON.stringify(input.body),
    });
    const handled = await handler.handle(request, {
      prefix: "/api",
      context: {
        apiKey: {
          id: "telegram-bot-key",
          name: "Telegram bot",
          permissions: {},
        },
        reqHeaders: request.headers,
      },
    });

    expect(handled.response?.status).toBe(201);
    await expect(handled.response?.json()).resolves.toEqual(response.body);
    await expect(
      new OpenAPIGenerator({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }).generate(loaded.router, {
        info: {
          title: "NEAR Builders API",
          version: "1.0.0",
        },
      }),
    ).resolves.toMatchObject({
      paths: {
        "/builders/nominations": {
          post: expect.any(Object),
        },
      },
    });
  });

  it("returns a loopback join URL when the development API is called locally", async () => {
    const response = {
      status: 201 as const,
      headers: {
        "cache-control": "no-store",
      },
      body: {
        nominationId: "nom_local_handoff",
        joinUrl: "https://nearbuilders.org/join?nomination=local-opaque-token",
      },
    };
    const createTelegramNomination = vi.fn(async () => response);
    const loaded = await loadApi({ createTelegramNomination }, {});
    const handler = new OpenAPIHandler(loaded.router);
    const body = {
      source: "telegram" as const,
      sourceNominationId: "43",
      nomineeTelegramId: 123,
      nomineeUsername: null,
      nominatedByTelegramId: 456,
      telegramGroupId: -100789,
    };
    const request = new Request("http://localhost:3002/api/builders/nominations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "localhost:3002",
        "idempotency-key": "telegram-nomination:43",
        "x-api-key": "test-api-key-placeholder",
      },
      body: JSON.stringify(body),
    });
    const handled = await handler.handle(request, {
      prefix: "/api",
      context: {
        apiKey: {
          id: "telegram-bot-key",
          name: "Telegram bot",
          permissions: {},
        },
        reqHeaders: request.headers,
      },
    });

    expect(handled.response?.status).toBe(201);
    await expect(handled.response?.json()).resolves.toEqual({
      nominationId: "nom_local_handoff",
      joinUrl: "http://localhost:3002/join?nomination=local-opaque-token",
    });
  });
});
