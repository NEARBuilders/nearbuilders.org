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
    "0005_builder_catalog_metadata.sql",
    "0006_builder_city_node.sql",
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1785400000000 + index,
      hash: `builders-catalog-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe.sequential("Builder NEAR Catalog details", () => {
  const runtime = createPluginRuntime({ registry: { builders: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"builders">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-builders-catalog-"));
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

  it("stores and normalizes catalog details on create", async () => {
    const created = await adminClient().createBuilder({
      nearAccount: "catalog-one.near",
      name: "Catalog One",
      links: { telegram: "https://t.me/catalog_one" },
      catalog: {
        preferredContact: "Telegram",
        organization: "  Example Labs ",
        team: " ",
        jobTitle: "Engineer",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
    });
    expect(created.data.catalog).toEqual({
      preferredContact: "Telegram",
      organization: "Example Labs",
      jobTitle: "Engineer",
      avatarUrl: "https://cdn.example.com/avatar.png",
    });

    const read = await anonClient().getBuilder({ nearAccount: "catalog-one.near" });
    expect(read.data.catalog).toEqual(created.data.catalog);
  });

  it("keeps catalog details when other fields change and clears them with null", async () => {
    await adminClient().createBuilder({
      nearAccount: "catalog-two.near",
      name: "Catalog Two",
      catalog: { organization: "Example Labs", publicEmail: "two@example.com" },
    });
    const owner = ownerClient("catalog-two.near");

    const renamed = await owner.updateBuilderProfile({
      nearAccount: "catalog-two.near",
      name: "Catalog 2",
    });
    expect(renamed.data.catalog).toEqual({
      organization: "Example Labs",
      publicEmail: "two@example.com",
    });

    const updated = await owner.updateBuilderProfile({
      nearAccount: "catalog-two.near",
      catalog: { preferredContact: "Email", publicEmail: "two@example.com" },
    });
    expect(updated.data.catalog).toEqual({
      preferredContact: "Email",
      publicEmail: "two@example.com",
    });

    const cleared = await owner.updateBuilderProfile({
      nearAccount: "catalog-two.near",
      catalog: null,
    });
    expect(cleared.data.catalog).toBeNull();
  });

  it("requires the preferred contact to be filled in", async () => {
    await expect(
      adminClient().createBuilder({
        nearAccount: "catalog-three.near",
        name: "Catalog Three",
        catalog: { preferredContact: "Telegram" },
      }),
    ).rejects.toThrow(/Telegram link/);

    await adminClient().createBuilder({
      nearAccount: "catalog-three.near",
      name: "Catalog Three",
      links: { twitter: "https://x.com/catalog_three" },
      catalog: { preferredContact: "X" },
    });
    const owner = ownerClient("catalog-three.near");
    await expect(
      owner.updateBuilderProfile({ nearAccount: "catalog-three.near", links: {} }),
    ).rejects.toThrow(/X link/);
    await expect(
      owner.updateBuilderProfile({
        nearAccount: "catalog-three.near",
        catalog: { preferredContact: "Email" },
      }),
    ).rejects.toThrow(/public email/);
  });

  it("rejects invalid catalog details", async () => {
    await expect(
      adminClient().createBuilder({
        nearAccount: "catalog-four.near",
        catalog: { publicEmail: "not-an-email" },
      }),
    ).rejects.toThrow();
    await expect(
      adminClient().createBuilder({
        nearAccount: "catalog-four.near",
        catalog: { avatarUrl: "ftp://cdn.example.com/a.png" },
      }),
    ).rejects.toThrow();
    await expect(
      adminClient().createBuilder({
        nearAccount: "catalog-four.near",
        catalog: { jobTitle: "a".repeat(81) },
      }),
    ).rejects.toThrow();
  });
});
