import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const files = ["0000_create_bookmarks.sql", "0001_account_keyed_bookmarks.sql"];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1748800000000 + index,
      hash: `bookmarks-test-${index}`,
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

describe("bookmarks keyed on NEAR accounts (#329)", () => {
  const runtime = createPluginRuntime({ registry: { bookmarks: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"bookmarks">>>;
  const as = (userId: string, accounts?: string[]) =>
    loaded.createClient(caller(userId, accounts) as never);
  const isBookmarked = async (client: ReturnType<typeof as>, entityId: string) =>
    (await client.getUserBookmark({ entityId })).isBookmarked;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-bookmarks-plugin-"));
    loaded = await runtime.usePlugin("bookmarks", {
      variables: {},
      secrets: { BOOKMARKS_DATABASE_URL: `pglite:${dataDir}` },
    });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("follows the account across a primary switch and a reissued user id", async () => {
    await as("u-1", ["erin.near", "erin-alt.near"]).bookmark({ entityId: "p-1" });
    expect(await isBookmarked(as("u-1", ["erin-alt.near", "erin.near"]), "p-1")).toBe(true);
    expect(await isBookmarked(as("u-1-new", ["erin.near"]), "p-1")).toBe(true);
    expect(await isBookmarked(as("u-stranger", ["frank.near"]), "p-1")).toBe(false);
  });

  it("unbookmarks from a linked account", async () => {
    await as("u-2", ["gina.near", "gina-alt.near"]).bookmark({ entityId: "p-2" });
    await as("u-2", ["gina-alt.near", "gina.near"]).unbookmark({ entityId: "p-2" });
    expect(await isBookmarked(as("u-2", ["gina.near"]), "p-2")).toBe(false);
  });

  it("claims a legacy user-id bookmark onto the account", async () => {
    await as("u-3").bookmark({ entityId: "p-3" });
    expect(await isBookmarked(as("u-3", ["hank.near"]), "p-3")).toBe(true);
    expect(await isBookmarked(as("u-3-new", ["hank.near"]), "p-3")).toBe(true);
  });

  it("keeps working for callers with no NEAR account", async () => {
    await as("u-4").bookmark({ entityId: "p-4" });
    expect(await isBookmarked(as("u-4"), "p-4")).toBe(true);
    expect(await isBookmarked(as("u-5"), "p-4")).toBe(false);
  });
});
