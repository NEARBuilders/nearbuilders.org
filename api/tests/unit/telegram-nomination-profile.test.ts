import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import ApiPlugin, { deriveTelegramNominationStatus } from "../../src/index";

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

function userContext(userId: string, nearAccount: string, linkedNearAccounts: string[] = []) {
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
      linkedAccounts: linkedNearAccounts.map((accountId) => ({
        accountId,
        network: "mainnet",
        publicKey: `public-key:${accountId}`,
        isPrimary: accountId === nearAccount,
      })),
      hasNearAccount: true,
    },
  };
}

function pluginFactories(
  builders: Record<string, unknown>,
  proposals: Record<string, unknown>,
  votes: Record<string, unknown> = {},
) {
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
    proposals: () => ({
      getProposals: async () => ({ data: [] }),
      ...proposals,
    }),
    votes: () => votes,
  };
}

describe("Builder profile submission", () => {
  const runtimes: Array<ReturnType<typeof createPluginRuntime>> = [];

  afterEach(async () => {
    await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
  });

  async function loadApi(
    builders: Record<string, unknown>,
    proposals: Record<string, unknown>,
    votes: Record<string, unknown> = {},
  ) {
    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    return await runtime.usePlugin(
      "api",
      {
        variables: {},
        secrets: { API_DATABASE_URL: "pglite:.bos/api/:memory:" },
      },
      pluginFactories(builders, proposals, votes) as never,
    );
  }

  it("creates the proposal before finalizing a ready nomination", async () => {
    const resolveNomination = vi.fn(async () => ({
      status: "ready" as const,
      nominationId: "nom_test_relationship",
      referralNominationId: "nom_test_relationship",
      source: "telegram" as const,
    }));
    const finalizeNomination = vi.fn(async () => ({
      nominationId: "nom_test_relationship",
      source: "telegram" as const,
    }));
    const propose = vi.fn(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveNomination,
        finalizeNomination,
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
      location: "Lisbon, Portugal",
      links: { website: "https://alice.example.com" },
    });

    expect(resolveNomination).toHaveBeenCalledWith({
      token: "n".repeat(48),
      recordOpen: false,
    });
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
    expect(finalizeNomination).toHaveBeenCalledWith({
      token: "n".repeat(48),
      proposalId: "prp_telegram_builder",
    });
    expect(propose.mock.invocationCallOrder[0]).toBeLessThan(
      finalizeNomination.mock.invocationCallOrder[0]!,
    );
  });

  it("attributes an X nomination to the proposal and finalizes it after creation", async () => {
    const resolveNomination = vi.fn(async () => ({
      status: "ready" as const,
      nominationId: "nom_x_relationship",
      referralNominationId: "nom_x_referral",
      source: "x" as const,
      referralContext: {
        sourcePostId: "x-post-profile",
        sourcePostUrl: "https://x.com/nearbuilders/status/x-post-profile",
        sourcePostText: "Nominate @alice",
        sourcePostCreatedAt: "2026-08-08T10:00:00.000Z",
        conversationId: "x-conversation-profile",
        replyToPostId: null,
        nominatorXId: "9001",
        nominatorXUsername: "nearbuilders",
        nomineeXId: "9002",
        nomineeXUsername: "alice",
      },
    }));
    const finalizeNomination = vi.fn(async () => ({
      nominationId: "nom_x_relationship",
      source: "x" as const,
    }));
    const propose = vi.fn(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveNomination,
        finalizeNomination,
        getMyBuilderProfile: async () => ({ data: null }),
      },
      { propose },
    );
    const client = loaded.createClient(userContext("x-user", "alice.near") as never);

    await expect(
      client.submitBuilderProfile({
        nominationToken: "x".repeat(48),
        name: "Alice",
        bio: "Builds useful things.",
        skills: ["TypeScript"],
      }),
    ).resolves.toMatchObject({ nominationId: "nom_x_relationship" });

    expect(propose).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "builders",
        entityId: "alice.near",
        source: "x",
        idempotencyKey: "x-builder-profile:nom_x_relationship",
        metadata: {
          nominationId: "nom_x_relationship",
          referralNominationId: "nom_x_referral",
          source: "x",
          sourcePostId: "x-post-profile",
          nomineeXId: "9002",
          nominatorXId: "9001",
        },
      }),
    );
    expect(finalizeNomination).toHaveBeenCalledWith({
      token: "x".repeat(48),
      proposalId: "prp_telegram_builder",
    });
    expect(propose.mock.invocationCallOrder[0]).toBeLessThan(
      finalizeNomination.mock.invocationCallOrder[0]!,
    );
  });

  it("retries an X profile proposal without finalizing after a failed attempt", async () => {
    const resolveNomination = vi.fn(async () => ({
      status: "ready" as const,
      nominationId: "nom_x_retry",
      referralNominationId: "nom_x_retry_referral",
      source: "x" as const,
      referralContext: {
        sourcePostId: "x-post-retry",
        sourcePostUrl: "https://x.com/nearbuilders/status/x-post-retry",
        sourcePostText: "Nominate @retry",
        sourcePostCreatedAt: "2026-08-08T10:00:00.000Z",
        conversationId: null,
        replyToPostId: null,
        nominatorXId: "9001",
        nominatorXUsername: "nearbuilders",
        nomineeXId: "9011",
        nomineeXUsername: "retry",
      },
    }));
    const finalizeNomination = vi.fn(async () => ({
      nominationId: "nom_x_retry",
      source: "x" as const,
    }));
    const propose = vi
      .fn()
      .mockRejectedValueOnce(new Error("proposal unavailable"))
      .mockImplementationOnce(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveNomination,
        finalizeNomination,
        getMyBuilderProfile: async () => ({ data: null }),
      },
      { propose },
    );
    const client = loaded.createClient(userContext("x-retry-user", "retry.near") as never);
    const input = {
      nominationToken: "y".repeat(48),
      name: "Retry",
      bio: "Retries safely.",
      skills: ["Rust"],
    };

    await expect(client.submitBuilderProfile(input)).rejects.toThrow("proposal unavailable");
    expect(finalizeNomination).not.toHaveBeenCalled();
    await expect(client.submitBuilderProfile(input)).resolves.toMatchObject({
      nominationId: "nom_x_retry",
    });
    expect(propose).toHaveBeenCalledTimes(2);
    expect(propose.mock.calls[0]?.[0]).toMatchObject({
      source: "x",
      idempotencyKey: "x-builder-profile:nom_x_retry",
    });
    expect(propose.mock.calls[1]?.[0]).toMatchObject({
      source: "x",
      idempotencyKey: "x-builder-profile:nom_x_retry",
    });
    expect(finalizeNomination).toHaveBeenCalledTimes(1);
  });

  it("leaves a ready nomination unfinalized when proposal creation fails and retries idempotently", async () => {
    const resolveNomination = vi.fn(async () => ({
      status: "ready" as const,
      nominationId: "nom_retry",
      referralNominationId: "nom_retry",
      source: "telegram" as const,
    }));
    const finalizeNomination = vi.fn(async () => ({
      nominationId: "nom_retry",
      source: "telegram" as const,
    }));
    const propose = vi
      .fn()
      .mockRejectedValueOnce(new Error("proposal unavailable"))
      .mockImplementationOnce(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveNomination,
        finalizeNomination,
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
    expect(finalizeNomination).not.toHaveBeenCalled();
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
    expect(finalizeNomination).toHaveBeenCalledTimes(1);
  });

  it.each([
    "invalid",
    "submitted",
  ] as const)("falls back to public onboarding for a %s nomination token", async (status) => {
    const resolveNomination = vi.fn(async () =>
      status === "invalid"
        ? { status }
        : {
            status,
            nominationId: "nom_used",
            referralNominationId: "nom_used",
            source: "telegram" as const,
          },
    );
    const finalizeNomination = vi.fn();
    const propose = vi.fn(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveNomination,
        finalizeNomination,
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

    expect(finalizeNomination).not.toHaveBeenCalled();
    expect(propose).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "web",
      }),
    );
    expect(propose.mock.calls[0]?.[0]).not.toHaveProperty("idempotencyKey");
  });

  it("submits publicly without a nomination and rejects non-HTTP profile links", async () => {
    const resolveNomination = vi.fn();
    const finalizeNomination = vi.fn();
    const propose = vi.fn(async (input: Record<string, unknown>) => proposalResult(input));
    const loaded = await loadApi(
      {
        resolveNomination,
        finalizeNomination,
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

    expect(resolveNomination).not.toHaveBeenCalled();
    expect(finalizeNomination).not.toHaveBeenCalled();
  });

  it("rejects a public profile submission when one is already pending", async () => {
    const proposal = proposalResult({
      pluginId: "builders",
      entityId: "alice.near",
      payload: {},
    }).data;
    const propose = vi.fn();
    const getProposals = vi.fn(async () => ({ data: [proposal] }));
    const loaded = await loadApi(
      { getMyBuilderProfile: async () => ({ data: null }) },
      { getProposals, propose },
    );
    const client = loaded.createClient(userContext("alice-user", "alice.near") as never);

    await expect(
      client.submitBuilderProfile({
        name: "Alice",
        bio: "Builds useful things.",
        skills: ["TypeScript"],
      }),
    ).rejects.toThrow("already pending review");
    expect(propose).not.toHaveBeenCalled();
  });

  it.each([
    { source: "submission", hasSubmitted: true, hasUpvote: false, voteCount: 0 },
    { source: "vote", hasSubmitted: false, hasUpvote: true, voteCount: 1 },
  ])("keeps a legacy $source nomination idempotent", async (legacy) => {
    const proposal = proposalResult({
      pluginId: "builders",
      entityId: `${legacy.source}.near`,
      payload: {},
    }).data;
    const upvote = vi.fn();
    const loaded = await loadApi(
      {},
      {
        getProposals: async () => ({ data: [proposal] }),
        getMySubmission: async () => ({ hasSubmitted: legacy.hasSubmitted }),
      },
      {
        getUserVote: async () => ({ entityId: proposal.id, hasUpvote: legacy.hasUpvote }),
        getUpvoteCount: async () => ({ entityId: proposal.id, totalCount: legacy.voteCount }),
        upvote,
      },
    );
    const client = loaded.createClient(userContext("alice-user", "alice.near") as never);

    await expect(client.nominateBuilder({ nearAccount: `${legacy.source}.near` })).resolves.toEqual(
      {
        data: {
          nearAccount: `${legacy.source}.near`,
          proposalId: proposal.id,
          nominationCount: proposal.submissionCount + legacy.voteCount,
          voteCount: legacy.voteCount,
          alreadyNominated: true,
        },
      },
    );
    expect(upvote).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent nominations and counts each user once", async () => {
    const runtime = createPluginRuntime({ registry: { api: { module: ApiPlugin } } });
    runtimes.push(runtime);
    let proposal: ReturnType<typeof proposalResult>["data"] | null = null;
    const submissions = new Set<string>();
    const votes = new Set<string>();
    const proposalInputs: Record<string, unknown>[] = [];
    let proposalWrites = 0;
    let voteWrites = 0;
    const emptyClient = () => ({});
    const loaded = await runtime.usePlugin(
      "api",
      {
        variables: {},
        secrets: { API_DATABASE_URL: "pglite:.bos/api/:memory:" },
      },
      {
        auth: emptyClient,
        activity: emptyClient,
        apps: emptyClient,
        builders: emptyClient,
        events: emptyClient,
        nearcatalog: emptyClient,
        notifications: emptyClient,
        projects: emptyClient,
        proposals: (context: ReturnType<typeof userContext>) => ({
          getProposals: async () => ({ data: proposal ? [proposal] : [] }),
          getMySubmission: async () => ({
            hasSubmitted:
              submissions.has(context.userId) || submissions.has(context.near.primaryAccountId),
          }),
          propose: async (input: Record<string, unknown>) => {
            proposalInputs.push(input);
            await Promise.resolve();
            if (proposal) throw new Error("proposal already exists");
            proposal = proposalResult(input).data;
            submissions.add(context.near.primaryAccountId);
            proposalWrites += 1;
            return { data: proposal };
          },
        }),
        votes: (context: ReturnType<typeof userContext>) => ({
          getUserVote: async ({ entityId }: { entityId: string }) => ({
            entityId,
            hasUpvote: votes.has(context.userId),
          }),
          getUpvoteCount: async ({ entityId }: { entityId: string }) => ({
            entityId,
            totalCount: votes.size,
          }),
          upvote: async ({ entityId }: { entityId: string }) => {
            const alreadyExists = votes.has(context.userId);
            votes.add(context.userId);
            if (!alreadyExists) voteWrites += 1;
            return { entityId, userId: context.userId, totalCount: votes.size };
          },
        }),
      } as never,
    );
    const alice = loaded.createClient(userContext("alice-user", "alice.near") as never);
    const bob = loaded.createClient(userContext("bob-user", "bob.near") as never);
    const carol = loaded.createClient(userContext("carol-user", "carol.near") as never);

    await Promise.all([
      alice.nominateBuilder({ nearAccount: "target.near" }),
      alice.nominateBuilder({ nearAccount: "target.near" }),
    ]);
    expect(proposalWrites).toBe(1);
    expect(voteWrites).toBe(0);
    expect(proposalInputs[0]).toMatchObject({
      idempotencyKey: "builder-nomination:alice-user:target.near",
    });

    await Promise.all([
      bob.nominateBuilder({ nearAccount: "target.near" }),
      bob.nominateBuilder({ nearAccount: "target.near" }),
    ]);
    expect(voteWrites).toBe(1);

    await carol.nominateBuilder({ nearAccount: "target.near" });
    await expect(carol.nominateBuilder({ nearAccount: "target.near" })).resolves.toMatchObject({
      data: { nominationCount: 3, voteCount: 2, alreadyNominated: true },
    });
    expect(proposalWrites).toBe(1);
    expect(voteWrites).toBe(2);
  });

  it("routes generic builder proposals through nomination dedupe", async () => {
    const proposal = proposalResult({
      pluginId: "builders",
      entityId: "generic-target.near",
      payload: { name: "Existing" },
    }).data;
    const propose = vi.fn();
    const upvote = vi.fn(async () => ({
      entityId: proposal.id,
      userId: "bob-user",
      totalCount: 1,
    }));
    const loaded = await loadApi(
      {},
      {
        getProposals: async () => ({ data: [proposal] }),
        getMySubmission: async () => ({ hasSubmitted: false }),
        propose,
      },
      {
        getUserVote: async () => ({ entityId: proposal.id, hasUpvote: false }),
        getUpvoteCount: async () => ({ entityId: proposal.id, totalCount: 0 }),
        upvote,
      },
    );
    const client = loaded.createClient(userContext("bob-user", "bob.near") as never);

    await expect(
      client.propose({
        pluginId: "builders",
        entityId: "generic-target.near",
        payload: { name: "Attempted overwrite" },
      }),
    ).resolves.toEqual({ data: proposal });
    expect(propose).not.toHaveBeenCalled();
    expect(upvote).toHaveBeenCalledTimes(1);
  });

  it.each([
    "approved",
    "rejected",
    "removed",
  ] as const)("rejects %s builder nominations without writing", async (reviewStatus) => {
    const proposal = {
      ...proposalResult({
        pluginId: "builders",
        entityId: `${reviewStatus}.near`,
        payload: {},
      }).data,
      reviewStatus,
    };
    const getMySubmission = vi.fn();
    const upvote = vi.fn();
    const loaded = await loadApi(
      {},
      { getProposals: async () => ({ data: [proposal] }), getMySubmission },
      { upvote },
    );
    const client = loaded.createClient(userContext("alice-user", "alice.near") as never);

    await expect(client.nominateBuilder({ nearAccount: `${reviewStatus}.near` })).rejects.toThrow(
      reviewStatus === "approved" ? "already listed" : "closed",
    );
    expect(getMySubmission).not.toHaveBeenCalled();
    expect(upvote).not.toHaveBeenCalled();
  });

  it("rejects self-nomination without reading or writing nomination records", async () => {
    const getProposals = vi.fn();
    const upvote = vi.fn();
    const loaded = await loadApi({}, { getProposals }, { upvote });
    const client = loaded.createClient(userContext("alice-user", "alice.near") as never);

    await expect(client.nominateBuilder({ nearAccount: "ALICE.NEAR" })).rejects.toThrow(
      "submit your own profile",
    );
    expect(getProposals).not.toHaveBeenCalled();
    expect(upvote).not.toHaveBeenCalled();
  });

  it("rejects nominations for another linked account", async () => {
    const getProposals = vi.fn();
    const upvote = vi.fn();
    const loaded = await loadApi({}, { getProposals }, { upvote });
    const client = loaded.createClient(
      userContext("alice-user", "alice.near", ["alice.near", "alice-secondary.near"]) as never,
    );

    await expect(client.nominateBuilder({ nearAccount: "ALICE-SECONDARY.NEAR" })).rejects.toThrow(
      "submit your own profile",
    );
    expect(getProposals).not.toHaveBeenCalled();
    expect(upvote).not.toHaveBeenCalled();
  });

  it("returns the public bot nomination response without internal proposal fields", async () => {
    const buildersResponse = {
      status: 201 as const,
      headers: {
        "cache-control": "no-store",
      },
      body: {
        nominationId: "nom_test_handoff",
        status: "awaiting_profile" as const,
        joinUrl: "https://nearbuilders.org/join?nomination=opaque-token-placeholder",
        proposalId: null,
        proposalEntityId: null,
      },
    };
    const response = {
      ...buildersResponse,
      body: {
        nominationId: "nom_test_handoff",
        status: "awaiting_profile" as const,
        joinUrl: "https://nearbuilders.org/join?nomination=opaque-token-placeholder",
      },
    };
    const createTelegramNomination = vi.fn(async () => buildersResponse);
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
        "/builders/nominations/claim": {
          post: expect.any(Object),
        },
      },
    });
  });

  it("passes through the receipt-only public X nomination response", async () => {
    const buildersResponse = {
      status: 201 as const,
      headers: { "cache-control": "no-store" },
      body: { nominationId: "nom_x_handoff" },
    };
    const createXNomination = vi.fn(async () => buildersResponse);
    const loaded = await loadApi({ createXNomination }, {});
    const client = loaded.createClient({
      apiKey: { id: "generic-api-key", name: "Integration", permissions: {} },
    } as never);
    const body = {
      source: "x" as const,
      sourceNominationId: "420000000000000001",
      sourcePostUrl: "https://x.com/nearbuilders/status/420000000000000001",
      sourcePostText: "Nominate @alice",
      sourcePostCreatedAt: "2026-08-08T10:00:00.000Z",
      nominatedByXId: "9001",
      nominatedByXUsername: "nearbuilders",
      nomineeXId: "9002",
      nomineeXUsername: "alice",
      conversationId: "420000000000000001",
      replyToPostId: null,
    };
    const input = {
      headers: { "idempotency-key": "x-nomination:420000000000000001" },
      body,
    };

    await expect(client.createXNomination(input)).resolves.toEqual(buildersResponse);
    expect(createXNomination).toHaveBeenCalledWith(input);
  });

  it("preserves the configured join domain when the development API is called locally", async () => {
    const buildersResponse = {
      status: 201 as const,
      headers: {
        "cache-control": "no-store",
      },
      body: {
        nominationId: "nom_local_handoff",
        status: "awaiting_profile" as const,
        joinUrl: "https://nearbuilders.org/join?nomination=local-opaque-token",
        proposalId: null,
        proposalEntityId: null,
      },
    };
    const createTelegramNomination = vi.fn(async () => buildersResponse);
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
      status: "awaiting_profile",
      joinUrl: "https://nearbuilders.org/join?nomination=local-opaque-token",
    });
  });

  it("preserves the configured join domain when a development claim completes verification", async () => {
    const claimTelegramNomination = vi.fn(async () => ({
      nominationId: "nom_local_claim",
      status: "awaiting_profile" as const,
      joinUrl: "https://nearbuilders.org/join?nomination=claimed-local-token",
      proposalId: null,
      proposalEntityId: null,
    }));
    const loaded = await loadApi({ claimTelegramNomination }, {});
    const handler = new OpenAPIHandler(loaded.router);
    const body = {
      nominationId: "nom_local_claim",
      nomineeTelegramId: 123,
      nomineeUsername: "alice",
    };
    const request = new Request("http://localhost:3002/api/builders/nominations/claim", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "localhost:3002",
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

    expect(handled.response?.status).toBe(200);
    await expect(handled.response?.json()).resolves.toEqual({
      nominationId: "nom_local_claim",
      status: "awaiting_profile",
      joinUrl: "https://nearbuilders.org/join?nomination=claimed-local-token",
    });
  });

  it.each([
    [
      { reviewStatus: "pending", applyStatus: "not_started", removeStatus: "not_started" },
      "under_review",
    ],
    [
      { reviewStatus: "approved", applyStatus: "applying", removeStatus: "not_started" },
      "processing",
    ],
    [{ reviewStatus: "approved", applyStatus: "applied", removeStatus: "removing" }, "processing"],
    [{ reviewStatus: "approved", applyStatus: "applied", removeStatus: "not_started" }, "accepted"],
    [
      { reviewStatus: "rejected", applyStatus: "not_started", removeStatus: "not_started" },
      "rejected",
    ],
    [{ reviewStatus: "removed", applyStatus: "applied", removeStatus: "removed" }, "removed"],
    [
      { reviewStatus: "approved", applyStatus: "failed", removeStatus: "not_started" },
      "processing_failed",
    ],
    [
      { reviewStatus: "approved", applyStatus: "applied", removeStatus: "failed" },
      "processing_failed",
    ],
  ] as const)("maps proposal lifecycle %# to %s", (proposal, expected) => {
    expect(deriveTelegramNominationStatus(proposal)).toBe(expected);
  });

  it("claims a nomination and derives its current status from the linked proposal", async () => {
    const claimTelegramNomination = vi.fn(async () => ({
      nominationId: "nom_claimed",
      status: "submitted" as const,
      proposalId: "prp_telegram_builder",
      proposalEntityId: "alice.near",
    }));
    const proposal = proposalResult({ pluginId: "builders", entityId: "alice.near" });
    const acceptedProposal = {
      ...proposal.data,
      reviewStatus: "approved" as const,
      applyStatus: "applied" as const,
    };
    const getProposals = vi.fn(async () => ({
      data: [acceptedProposal],
      meta: { total: 1, hasMore: false, nextCursor: null },
    }));
    const loaded = await loadApi({ claimTelegramNomination }, { getProposals });
    const client = loaded.createClient({
      apiKey: { id: "telegram-bot-key", name: "Telegram bot", permissions: {} },
    } as never);

    await expect(
      client.claimTelegramNomination({
        nominationId: "nom_claimed",
        nomineeTelegramId: 123,
        nomineeUsername: "alice",
      }),
    ).resolves.toEqual({ nominationId: "nom_claimed", status: "accepted" });
    expect(getProposals).toHaveBeenCalledWith({
      pluginId: "builders",
      entityId: "alice.near",
      limit: 2,
    });
  });

  it("treats a missing linked proposal as an invariant failure", async () => {
    const loaded = await loadApi(
      {
        claimTelegramNomination: async () => ({
          nominationId: "nom_broken",
          status: "submitted" as const,
          proposalId: "prp_missing",
          proposalEntityId: "missing.near",
        }),
      },
      {
        getProposals: async () => ({
          data: [],
          meta: { total: 0, hasMore: false, nextCursor: null },
        }),
      },
    );
    const client = loaded.createClient({
      apiKey: { id: "telegram-bot-key", name: "Telegram bot", permissions: {} },
    } as never);

    await expect(
      client.claimTelegramNomination({
        nominationId: "nom_broken",
        nomineeTelegramId: 123,
        nomineeUsername: "alice",
      }),
    ).rejects.toThrow("Linked builder proposal was not found");
  });
});
