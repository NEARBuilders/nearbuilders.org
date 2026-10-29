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
    locale: null,
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
    "0005_builder_city_node.sql",
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1785400000000 + index,
      hash: `builders-city-node-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe.sequential("Builder city node", () => {
  const runtime = createPluginRuntime({ registry: { builders: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"builders">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-builders-city-node-"));
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

  it("stores the city node on create and filters the public list by it", async () => {
    const created = await adminClient().createBuilder({
      nearAccount: "lakeside-dev.near",
      name: "Lakeside Dev",
      cityNode: "Lakeside",
    });
    expect(created.data.cityNode).toBe("lakeside");
    await adminClient().createBuilder({ nearAccount: "elsewhere-dev.near", name: "Elsewhere" });

    const filtered = await anonClient().listBuilders({ cityNode: "lakeside" });
    expect(filtered.data.map((b) => b.nearAccount)).toEqual(["lakeside-dev.near"]);
    expect(filtered.meta.total).toBe(1);
  });

  it("lets the owner change, keep and clear their city node", async () => {
    await adminClient().createBuilder({
      nearAccount: "mover.near",
      name: "Mover",
      cityNode: "lakeside",
    });
    const owner = ownerClient("mover.near");

    const moved = await owner.updateBuilderProfile({
      nearAccount: "mover.near",
      cityNode: "west-province/hill-valley",
    });
    expect(moved.data.cityNode).toBe("west-province/hill-valley");

    const kept = await owner.updateBuilderProfile({ nearAccount: "mover.near", bio: "Still here" });
    expect(kept.data.cityNode).toBe("west-province/hill-valley");

    const cleared = await owner.updateBuilderProfile({ nearAccount: "mover.near", cityNode: null });
    expect(cleared.data.cityNode).toBeNull();
    const list = await anonClient().listBuilders({ cityNode: "west-province/hill-valley" });
    expect(list.data.map((b) => b.nearAccount)).not.toContain("mover.near");
  });

  it("rejects a value that is not a community slug", async () => {
    await adminClient().createBuilder({ nearAccount: "typo.near", name: "Typo" });
    await expect(
      ownerClient("typo.near").updateBuilderProfile({
        nearAccount: "typo.near",
        cityNode: "Hill Valley!",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
