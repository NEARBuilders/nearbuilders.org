import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const files = ["0000_create_votes.sql", "0001_account_keyed_votes.sql"];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1748800000000 + index,
      hash: `votes-test-${index}`,
      tag: files[index],
      // 0000 predates breakpoints and separates its statements with blank lines.
      sql: source
        .split(/--> statement-breakpoint|;\n\n/)
        .map((statement) => statement.trim())
        .filter(Boolean),
    })),
  };
});

function caller(userId: string, accounts: string[] = []) {
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
      primaryAccountId: accounts[0] ?? null,
      linkedAccounts: accounts.map((accountId, index) => ({
        accountId,
        network: "mainnet",
        publicKey: "",
        isPrimary: index === 0,
      })),
      hasNearAccount: accounts.length > 0,
    },
  };
}

describe("votes keyed on NEAR accounts (#329)", () => {
  const runtime = createPluginRuntime({ registry: { votes: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"votes">>>;
  const as = (userId: string, accounts?: string[]) =>
    loaded.createClient(caller(userId, accounts) as never);

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-votes-plugin-"));
    loaded = await runtime.usePlugin("votes", {
      variables: {},
      secrets: { VOTES_DATABASE_URL: `pglite:${dataDir}` },
    });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("keeps a vote visible after the voter switches primary to a linked account", async () => {
    await as("u-switch", ["alice.near", "alice-alt.near"]).upvote({ entityId: "e-switch" });
    const after = as("u-switch", ["alice-alt.near", "alice.near"]);
    expect(await after.getUserVote({ entityId: "e-switch" })).toMatchObject({ hasUpvote: true });
    // Voting again from the new primary doesn't add a second vote.
    const again = await after.upvote({ entityId: "e-switch" });
    expect(again.totalCount).toBe(1);
  });

  it("matches the vote by account even when the auth user id changes", async () => {
    await as("u-old", ["bob.near"]).upvote({ entityId: "e-reissued" });
    const reissued = as("u-new", ["bob.near"]);
    expect(await reissued.getUserVote({ entityId: "e-reissued" })).toMatchObject({
      hasUpvote: true,
    });
    expect((await reissued.upvote({ entityId: "e-reissued" })).totalCount).toBe(1);
    expect((await reissued.downvote({ entityId: "e-reissued" })).totalCount).toBe(0);
  });

  it("claims a legacy user-id vote onto the account instead of double counting", async () => {
    // A vote cast with no NEAR account has the legacy shape: user id only.
    await as("u-legacy").upvote({ entityId: "e-legacy" });
    const linked = as("u-legacy", ["carol.near"]);
    expect((await linked.upvote({ entityId: "e-legacy" })).totalCount).toBe(1);

    // Once claimed, the vote follows the account to a reissued user id.
    expect(
      await as("u-legacy-new", ["carol.near"]).getUserVote({ entityId: "e-legacy" }),
    ).toMatchObject({ hasUpvote: true });
  });

  it("drops a legacy vote that duplicates one the account already holds", async () => {
    await as("u-dup").upvote({ entityId: "e-dup" });
    await as("u-other", ["dave.near"]).upvote({ entityId: "e-dup" });
    const counts = await as("u-dup", ["dave.near"]).getUserVotes({ entityIds: ["e-dup"] });
    expect(counts["e-dup"]).toMatchObject({ hasUpvote: true });
    expect((await as("anyone").getUpvoteCount({ entityId: "e-dup" })).totalCount).toBe(1);
  });

  it("still keys votes on the user id for callers with no NEAR account", async () => {
    const plain = as("u-plain");
    await plain.upvote({ entityId: "e-plain" });
    expect(await plain.getUserVote({ entityId: "e-plain" })).toMatchObject({ hasUpvote: true });
    expect(await as("u-stranger").getUserVote({ entityId: "e-plain" })).toMatchObject({
      hasUpvote: false,
    });
    expect((await plain.downvote({ entityId: "e-plain" })).totalCount).toBe(0);
  });
});
