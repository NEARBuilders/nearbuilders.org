import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";
import { startFakeActivity } from "./fake-activity";

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
    locale: null,
  };
}

vi.mock("virtual:drizzle-migrations.sql", async () => {
  const files = [
    "0000_third_dazzler.sql",
    "0001_clear_champions.sql",
    "0002_parched_edwin_jarvis.sql",
    "0003_jazzy_silver_surfer.sql",
  ];
  const timestamps = [1782299122315, 1783924992496, 1789520000000, 1791930786995];
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

/**
 * Stands in for activity.nearbuilders.org: it keeps submitted events, honours retractions, and serves
 * them back from its feed, so reads exercise the real client. `calls` lists only the writes.
 */
async function startFakeGateway() {
  const events = new Map<string, Record<string, unknown>>();
  let submitted = 0;
  const activity = await startFakeActivity({
    submitActivityEvent: (input) => {
      submitted += 1;
      const eventId = `${"f".repeat(63)}${submitted}`;
      events.set(eventId, {
        id: eventId,
        source: "nearbuilders",
        type: input.eventType,
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        timestamp: new Date().toISOString(),
        payload: input.payload,
        provenance: { approvalStatus: "approved" },
      });
      return { eventId };
    },
    retractActivityEvent: (input) => {
      events.delete(input.eventId);
      return {};
    },
    listActivityEvents: (input) => ({
      data: [...events.values()].filter((event) => !input.type || event.type === input.type),
      meta: { hasMore: false, nextCursor: null, skippedInvalid: 0 },
    }),
  });
  return {
    ...activity,
    get calls() {
      return activity.calls.filter(({ procedure }) => procedure !== "listActivityEvents");
    },
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
    loaded = await runtime.usePlugin(
      "activity",
      {
        variables: {},
        secrets: {
          ACTIVITY_DATABASE_URL: `pglite:${dataDir}`,
          ACTIVITY_GATEWAY_URL: gateway.url,
          ACTIVITY_GATEWAY_API_KEY: "act_test_key",
        },
      },
      { activityApi: { client: () => gateway.client } },
    );
  }, 60_000);

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
      procedure: "submitActivityEvent",
      authorization: "Bearer act_test_key",
      input: {
        eventType: "project.approved",
        actor: "alice.near",
        idempotencyKey: "proposal-approved:p1:1",
      },
    });

    const feed = await loaded.createClient().getActivityFeed({ source: "projects" });
    expect(feed.data.map(({ id }) => id)).toContain(approved.id);

    await admin.hideActivity({ id: approved.id });
    expect(gateway.calls[1]).toMatchObject({
      procedure: "retractActivityEvent",
      authorization: "Bearer act_test_key",
      input: { eventId: `${"f".repeat(63)}1`, idempotencyKey: "retract:proposal-approved:p1:1" },
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
      procedure: "submitActivityEvent",
      input: { eventType: "builder.approved", actor: "bob.near" },
    });

    const feed = await loaded.createClient().getActivityFeed({ source: "builders" });
    expect(feed.data.map(({ id }) => id)).toEqual([published.id]);

    const hidden = await admin.hideActivity({ id: published.id });
    expect(hidden).toMatchObject({ source: "builders", type: "approved", actor: "bob.near" });
    expect(gateway.calls[before + 1]?.procedure).toBe("retractActivityEvent");
    const afterHide = await loaded.createClient().getActivityFeed({ source: "builders" });
    expect(afterHide.data).toHaveLength(0);

    await expect(admin.hideActivity({ id: "act_unknown" })).rejects.toThrow(
      "Activity event not found",
    );
    await admin.setActivityGatewayMode({ mode: "legacy-only" });
  });
});
