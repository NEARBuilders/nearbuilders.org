import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG_LISTING_SYNC } from "../contract";
import Plugin from "../index";

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = [
    "0000_happy_black_bolt.sql",
    "0001_plain_tusk.sql",
    "0002_catalog_listings.sql",
    "0003_catalog_listing_sends.sql",
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: 1783692963943 + index,
      hash: `nearcatalog-sends-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

const token = "nc-plugin-token-9c1d";

function testUser(id: string, role: string) {
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

const projectRecord = {
  slug: "lantern-pay",
  title: "Lantern Pay",
  oneliner: "Payments for small shops",
  description: "Lantern Pay lets small shops take NEAR payments.",
  logo: "https://lantern.example.com/logo.png",
  categories: ["payment"],
  website: "",
  twitter: "",
  medium: "",
  telegram: "",
  github: "",
  discord: "",
  whitepaper: "",
  "token-address": "",
  "coingecko-address": "",
  "nearsocial-address": "",
  dapp: "",
  phase: "testnet",
  source: {
    site: "nearbuilders.org",
    url: "https://nearbuilders.org/projects/project/lantern-pay-x1",
    nearAccount: "maker.testnet",
    updatedAt: "2026-10-26T00:00:00.000Z",
  },
};

describe("NearCatalog plugin sending", { timeout: 20_000 }, () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  async function loadPlugin(secrets: Record<string, string>) {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(input), init });
        return Response.json({ status: "success", submission_id: "sub-1" });
      }),
    );
    const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-nearcatalog-sends-"));
    const runtime = createPluginRuntime({ registry: { nearcatalog: { module: Plugin } } });
    const loaded = await runtime.usePlugin("nearcatalog", {
      variables: { baseUrl: "https://api.nearcatalog.xyz" },
      secrets: { NEARCATALOG_DATABASE_URL: `pglite:${dataDir}`, ...secrets },
    });
    cleanups.push(async () => {
      await runtime.shutdown();
      await rm(dataDir, { recursive: true, force: true });
    });
    const sync = loaded.createClient({ [CATALOG_LISTING_SYNC]: true } as never);
    const approve = async () => {
      await sync.markCatalogListingPending({
        kind: "project",
        entityId: "project-1",
        ownerId: "maker.testnet",
        slug: "lantern-pay",
      });
      return await sync.approveCatalogListing({
        kind: "project",
        entityId: "project-1",
        ownerId: "maker.testnet",
        slug: "lantern-pay",
        record: projectRecord,
        approvedBy: "reviewer.testnet",
      });
    };
    return {
      requests,
      approve,
      admin: loaded.createClient({ userId: "admin", user: testUser("admin", "admin") }),
      member: loaded.createClient({ userId: "member", user: testUser("member", "member") }),
    };
  }

  it("stays off without the partner key", async () => {
    const plugin = await loadPlugin({ NEARCATALOG_CONTACT: "team@nearbuilders.example" });

    const approved = await plugin.approve();

    expect(approved.data).toMatchObject({ status: "approved", sendStatus: null });
    expect(plugin.requests).toHaveLength(0);
    await expect(plugin.admin.listCatalogListingSends({})).resolves.toMatchObject({
      enabled: false,
    });
  });

  it("sends to the partner endpoint with the key and keeps it out of every reply", async () => {
    const plugin = await loadPlugin({
      NEARCATALOG_PARTNER_KEY: token,
      NEARCATALOG_CONTACT: "team@nearbuilders.example",
    });

    const approved = await plugin.approve();

    expect(approved.data).toMatchObject({ status: "approved", sendStatus: "sent" });
    expect(plugin.requests[0]?.url).toBe(
      "https://indexer.nearcatalog.xyz/wp-json/nearcatalog/v1/partner-submit",
    );
    expect(plugin.requests[0]?.init?.method).toBe("POST");
    expect(new Headers(plugin.requests[0]?.init?.headers).get("authorization")).toBe(
      `Bearer ${token}`,
    );
    const sends = await plugin.admin.listCatalogListingSends({});
    expect(sends.enabled).toBe(true);
    expect(JSON.stringify([approved, sends])).not.toContain(token);
  });

  it("keeps send status and retries admin only", async () => {
    const plugin = await loadPlugin({
      NEARCATALOG_PARTNER_KEY: token,
      NEARCATALOG_CONTACT: "team@nearbuilders.example",
    });
    await plugin.approve();

    await expect(plugin.member.listCatalogListingSends({})).rejects.toThrow(
      "Admin access required",
    );
    await expect(
      plugin.member.retryCatalogListingSend({ kind: "project", entityId: "project-1" }),
    ).rejects.toThrow("Admin access required");
    await expect(
      plugin.admin.retryCatalogListingSend({ kind: "project", entityId: "project-1" }),
    ).rejects.toThrow("Nothing to send");
  });
});
