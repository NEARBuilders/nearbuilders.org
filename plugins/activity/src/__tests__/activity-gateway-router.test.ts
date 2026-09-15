import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
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
  const files = [
    "0000_third_dazzler.sql",
    "0001_clear_champions.sql",
    "0002_parched_edwin_jarvis.sql",
  ];
  const timestamps = [1782299122315, 1783924992496, 1789520000000];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../db/migrations/${file}`, import.meta.url), "utf8")),
  );
  return {
    default: sources.map((source, index) => ({
      idx: index,
      when: timestamps[index],
      hash: `activity-gateway-test-${index}`,
      tag: files[index],
      sql: source.split("--> statement-breakpoint").map((statement) => statement.trim()),
    })),
  };
});

type GatewayCall = { path: string; authorization: string | undefined; body: any };

/** Stands in for activity.nearbuilders.org over real HTTP, so the plugin's client is exercised. */
async function startFakeGateway() {
  const calls: GatewayCall[] = [];
  const server: Server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      calls.push({
        path: request.url ?? "",
        authorization: request.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      });
      const isSubmit = request.url === "/v1/events";
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(isSubmit ? { eventId: `${"f".repeat(63)}${calls.length}` } : {}));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake gateway did not bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    calls,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("activity gateway routes", () => {
  const runtime = createPluginRuntime({ registry: { activity: { module: Plugin } } });
  let dataDir: string;
  let gateway: Awaited<ReturnType<typeof startFakeGateway>>;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"activity">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-activity-gateway-routes-"));
    gateway = await startFakeGateway();
    loaded = await runtime.usePlugin("activity", {
      variables: {},
      secrets: {
        ACTIVITY_DATABASE_URL: `pglite:${dataDir}`,
        ACTIVITY_GATEWAY_URL: gateway.url,
        ACTIVITY_GATEWAY_API_KEY: "act_test_key",
      },
    });
  });

  afterAll(async () => {
    await runtime.shutdown();
    await gateway.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  function adminClient() {
    return loaded.createClient({
      userId: "admin",
      near: testNear("admin.near"),
      user: testUser("admin", "admin"),
    });
  }

  it("keeps the gateway idle until an administrator switches the mode", async () => {
    const admin = adminClient();
    const member = loaded.createClient({
      userId: "member",
      near: testNear("alice.near"),
      user: testUser("member", "member"),
    });

    await expect(member.getActivityGatewayStatus()).rejects.toThrow("Admin access required");
    await expect(admin.getActivityGatewayStatus()).resolves.toMatchObject({
      mode: "legacy-only",
      configured: true,
      counts: { pending: 0, sent: 0, failed: 0 },
    });

    await admin.emitTrustedActivity({
      source: "projects",
      type: "approved",
      actor: "alice.near",
      payload: { proposalId: "legacy-only" },
      idempotencyKey: "proposal-approved:legacy-only:1",
    });
    expect(gateway.calls).toHaveLength(0);
  });

  it("dual-writes approvals and revocations once the mode is switched", async () => {
    const admin = adminClient();
    await expect(admin.setActivityGatewayMode({ mode: "dual-write" })).resolves.toMatchObject({
      mode: "dual-write",
    });

    const approved = await admin.emitTrustedActivity({
      source: "projects",
      type: "approved",
      actor: "alice.near",
      payload: { proposalId: "p1" },
      idempotencyKey: "proposal-approved:p1:1",
    });
    expect(approved.verified).toBe(true);

    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]).toMatchObject({
      path: "/v1/events",
      authorization: "Bearer act_test_key",
      body: {
        eventType: "project.approved",
        actor: "alice.near",
        idempotencyKey: "proposal-approved:p1:1",
      },
    });

    const feed = await loaded.createClient().getActivityFeed({ source: "projects" });
    expect(feed.data.map(({ id }) => id)).toContain(approved.id);

    await admin.hideActivity({ id: approved.id });
    expect(gateway.calls[1]).toMatchObject({
      path: `/v1/events/${"f".repeat(63)}1/retract`,
      body: { idempotencyKey: "retract:proposal-approved:p1:1" },
    });
    const afterHide = await loaded.createClient().getActivityFeed({ source: "projects" });
    expect(afterHide.data.map(({ id }) => id)).not.toContain(approved.id);

    await expect(admin.getActivityGatewayStatus()).resolves.toMatchObject({
      counts: { pending: 0, sent: 2, failed: 0 },
    });
  });

  it("does not forward self-reported profile uploads", async () => {
    const member = loaded.createClient({
      userId: "member",
      near: testNear("alice.near"),
      user: testUser("member", "member"),
    });
    const before = gateway.calls.length;

    await member.emitActivity({ source: "manual", type: "upload", payload: { link: "x" } });

    expect(gateway.calls).toHaveLength(before);
  });

  it("stops writing legacy rows in standalone-only mode but still publishes and retracts", async () => {
    const admin = adminClient();
    await admin.setActivityGatewayMode({ mode: "standalone-only" });
    const before = gateway.calls.length;

    const published = await admin.emitTrustedActivity({
      source: "builders",
      type: "approved",
      actor: "bob.near",
      payload: { proposalId: "b1" },
      idempotencyKey: "proposal-approved:b1:1",
    });
    expect(published.id.startsWith("gateway_")).toBe(true);
    expect(gateway.calls[before]).toMatchObject({
      path: "/v1/events",
      body: { eventType: "builder.approved", actor: "bob.near" },
    });

    const feed = await loaded.createClient().getActivityFeed({ source: "builders" });
    expect(feed.data).toHaveLength(0);

    const hidden = await admin.hideActivity({ id: published.id });
    expect(hidden).toMatchObject({ source: "builders", type: "approved", actor: "bob.near" });
    expect(gateway.calls[before + 1]?.path).toContain("/retract");

    await expect(admin.hideActivity({ id: "act_unknown" })).rejects.toThrow(
      "Activity event not found",
    );
    await admin.setActivityGatewayMode({ mode: "legacy-only" });
  });
});
