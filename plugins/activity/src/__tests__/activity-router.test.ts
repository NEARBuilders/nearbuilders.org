import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

function testNear(primaryAccountId: string) {
  return { primaryAccountId, linkedAccounts: [], hasNearAccount: true };
}

function testUser(id: string, role: string) {
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

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const files = ["0000_third_dazzler.sql", "0001_clear_champions.sql"];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      hash: `activity-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

describe("activity router", () => {
  const runtime = createPluginRuntime({ registry: { activity: { module: Plugin } } });
  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"activity">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-activity-plugin-"));
    loaded = await runtime.usePlugin("activity", {
      variables: {},
      secrets: { ACTIVITY_DATABASE_URL: `pglite:${dataDir}` },
    });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  it("derives manual identity and reserves verified events for admins", async () => {
    const member = loaded.createClient({
      userId: "member",
      near: testNear("alice.near"),
      user: testUser("member", "member"),
    });
    const admin = loaded.createClient({
      userId: "admin",
      near: testNear("admin.near"),
      user: testUser("admin", "admin"),
    });
    const manual = await (member.emitActivity as any)({
      source: "manual",
      type: "upload",
      actor: "mallory.near",
      verified: true,
      payload: {},
    });

    expect(manual).toMatchObject({ actor: "alice.near", verified: false });
    await expect(
      member.emitTrustedActivity({
        source: "nearcatalog",
        type: "claim",
        actor: "alice.near",
        payload: {},
        idempotencyKey: "claim:1",
      }),
    ).rejects.toThrow("Admin access required");

    const trusted = await admin.emitTrustedActivity({
      source: "nearcatalog",
      type: "claim",
      actor: "alice.near",
      payload: {},
      idempotencyKey: "claim:1",
    });
    expect(trusted.verified).toBe(true);
    await admin.hideActivity({ id: trusted.id });
    const feed = await loaded.createClient().getActivityFeed({});
    expect(feed.data.map((event) => event.id)).toEqual([manual.id]);
  });
});
