import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

function testUser(id: string, role = "member") {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    role,
    isAnonymous: false,
  };
}

function testNear(primaryAccountId: string) {
  return { primaryAccountId, linkedAccounts: [], hasNearAccount: true };
}

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const files = [
    "0000_large_power_man.sql",
    "0001_grey_prodigy.sql",
    "0002_chunky_roxanne_simpson.sql",
    "0003_slimy_talos.sql",
    "0004_nervous_tiger_shark.sql",
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1785400000000 + index,
      hash: `builders-withdrawal-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe.sequential("Builder profile withdrawal", () => {
  const runtime = createPluginRuntime({ registry: { builders: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"builders">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-builders-withdrawal-"));
    loaded = await runtime.usePlugin("builders", {
      variables: { nominationJoinBaseUrl: "https://nearbuilders.org" },
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

  const anonClient = () => loaded.createClient({});
  const adminClient = () =>
    loaded.createClient({ userId: "admin-1", user: testUser("admin-1", "admin") });
  const ownerClient = (account: string) =>
    loaded.createClient({
      userId: `user-${account}`,
      user: testUser(`user-${account}`),
      near: testNear(account),
    });

  async function createBuilder(account: string) {
    await adminClient().createBuilder({ nearAccount: account, name: account });
  }

  it("removes a withdrawn profile from the public list, search, and detail lookup", async () => {
    await createBuilder("leaving.near");

    const before = await anonClient().listBuilders({ search: "leaving" });
    expect(before.data.map((b) => b.nearAccount)).toContain("leaving.near");

    const withdrawn = await ownerClient("leaving.near").withdrawMyBuilderProfile({});
    expect(withdrawn.data.withdrawnAt).not.toBeNull();

    const list = await anonClient().listBuilders({ search: "leaving" });
    expect(list.data.map((b) => b.nearAccount)).not.toContain("leaving.near");

    await expect(anonClient().getBuilder({ nearAccount: "leaving.near" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("still shows a withdrawn profile to its owner and to admins", async () => {
    await createBuilder("owner-visible.near");
    await ownerClient("owner-visible.near").withdrawMyBuilderProfile({});

    const asOwner = await ownerClient("owner-visible.near").getBuilder({
      nearAccount: "owner-visible.near",
    });
    expect(asOwner.data.withdrawnAt).not.toBeNull();

    const asAdmin = await adminClient().getBuilder({ nearAccount: "owner-visible.near" });
    expect(asAdmin.data.nearAccount).toBe("owner-visible.near");
  });

  it("lists the profile again when the owner restores it", async () => {
    await createBuilder("comes-back.near");
    await ownerClient("comes-back.near").withdrawMyBuilderProfile({});

    const restored = await ownerClient("comes-back.near").restoreMyBuilderProfile({});
    expect(restored.data.withdrawnAt).toBeNull();

    const list = await anonClient().listBuilders({ search: "comes-back" });
    expect(list.data.map((b) => b.nearAccount)).toContain("comes-back.near");
  });

  it("rejects an unauthenticated withdrawal", async () => {
    await expect(anonClient().withdrawMyBuilderProfile({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("404s when the caller has no builder profile", async () => {
    await expect(ownerClient("no-profile.near").withdrawMyBuilderProfile({})).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });
});
