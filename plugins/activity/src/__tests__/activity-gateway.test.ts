import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabaseDriver } from "../db";
import {
  type ActivityGatewayClient,
  ActivityGatewayRequestError,
  createActivityGatewayMethods,
  createHttpActivityGatewayClient,
  gatewayEventType,
} from "../services/activity-gateway";

type SubmitCall = { eventType: string; actor: string; idempotencyKey: string; payload: unknown };
type RetractCall = { eventId: string; reason: string; idempotencyKey: string };

function recordingClient(
  behaviour: {
    submit?: (call: SubmitCall, index: number) => { eventId: string } | Error;
    retract?: (call: RetractCall) => Error | undefined;
  } = {},
) {
  const submits: SubmitCall[] = [];
  const retracts: RetractCall[] = [];
  const client: ActivityGatewayClient = {
    async submit(call) {
      submits.push(call);
      const result = behaviour.submit?.(call, submits.length - 1) ?? {
        eventId: `${"a".repeat(63)}${submits.length}`,
      };
      if (result instanceof Error) throw result;
      return result;
    },
    async retract(call) {
      retracts.push(call);
      const result = behaviour.retract?.(call);
      if (result instanceof Error) throw result;
    },
  };
  return { client, submits, retracts };
}

async function createGateway(
  client: ActivityGatewayClient | null,
  options: { now?: () => Date } = {},
) {
  const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-activity-gateway-"));
  const driver = await createDatabaseDriver(`pglite:${dataDir}`);
  await driver.db.execute(sql`
    CREATE TABLE "activity_settings" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await driver.db.execute(sql`
    CREATE TABLE "activity_gateway_outbox" (
      "id" text PRIMARY KEY NOT NULL,
      "operation" text NOT NULL,
      "legacy_event_id" text NOT NULL,
      "idempotency_key" text NOT NULL,
      "legacy_source" text NOT NULL,
      "legacy_type" text NOT NULL,
      "event_type" text NOT NULL,
      "actor" text NOT NULL,
      "payload" jsonb,
      "reason" text,
      "status" text NOT NULL,
      "attempts" integer DEFAULT 0 NOT NULL,
      "last_error" text,
      "gateway_event_id" text,
      "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await driver.db.execute(sql`
    CREATE UNIQUE INDEX "activity_gateway_outbox_operation_key_unique"
      ON "activity_gateway_outbox" ("operation", "idempotency_key")
  `);
  return {
    gateway: createActivityGatewayMethods(driver.db, client, options),
    cleanup: async () => {
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

const APPROVAL = {
  legacyEventId: "act_1",
  source: "projects",
  type: "approved",
  actor: "alice.near",
  payload: { proposalId: "p1" },
  idempotencyKey: "proposal-approved:p1:1",
};

describe("activity gateway", () => {
  it("maps the legacy writers and forwards nothing else", () => {
    expect(gatewayEventType("projects", "approved")).toBe("project.approved");
    expect(gatewayEventType("events", "approved")).toBe("event.approved");
    expect(gatewayEventType("builders", "approved")).toBe("builder.approved");
    expect(gatewayEventType("nearcatalog", "claim")).toBe("nearcatalog.claim");
    expect(gatewayEventType("manual", "upload")).toBeNull();
  });

  it("defaults to legacy-only and persists a mode change", async () => {
    const { gateway, cleanup } = await createGateway(null);
    try {
      await expect(gateway.getMode()).resolves.toBe("legacy-only");
      await gateway.setMode("dual-write");
      await expect(gateway.getMode()).resolves.toBe("dual-write");
      await gateway.setMode("standalone-only");
      await expect(gateway.getMode()).resolves.toBe("standalone-only");
    } finally {
      await cleanup();
    }
  });

  it("publishes once per idempotency key and records the Activity event ID", async () => {
    const { client, submits } = recordingClient();
    const { gateway, cleanup } = await createGateway(client);
    try {
      await gateway.trySend(await gateway.enqueuePublish(APPROVAL));
      await gateway.trySend(await gateway.enqueuePublish(APPROVAL));

      expect(submits).toHaveLength(1);
      expect(submits[0]).toMatchObject({
        eventType: "project.approved",
        actor: "alice.near",
        idempotencyKey: "proposal-approved:p1:1",
      });
      const status = await gateway.status();
      expect(status.counts).toMatchObject({ pending: 0, sent: 1, failed: 0 });
      const published = await gateway.findPublished("act_1");
      expect(published?.gatewayEventId).toBe(submits[0] && `${"a".repeat(63)}1`);
    } finally {
      await cleanup();
    }
  });

  it("does not forward an unmapped writer", async () => {
    const { client, submits } = recordingClient();
    const { gateway, cleanup } = await createGateway(client);
    try {
      const row = await gateway.enqueuePublish({
        ...APPROVAL,
        source: "manual",
        type: "upload",
        idempotencyKey: "manual:1",
      });
      expect(row).toBeNull();
      await gateway.trySend(row);
      expect(submits).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("keeps a retryable failure pending and succeeds on a later pass", async () => {
    let clock = new Date("2026-09-16T00:00:00.000Z");
    const { client, submits } = recordingClient({
      submit: (_call, index) =>
        index === 0
          ? new ActivityGatewayRequestError("Activity gateway returned 503", true)
          : { eventId: "b".repeat(64) },
    });
    const { gateway, cleanup } = await createGateway(client, { now: () => clock });
    try {
      await gateway.trySend(await gateway.enqueuePublish(APPROVAL));
      let status = await gateway.status();
      expect(status.counts).toMatchObject({ pending: 1, sent: 0, failed: 0 });

      await gateway.processDue();
      expect(submits).toHaveLength(1);

      clock = new Date(clock.getTime() + 60_000);
      await gateway.processDue();
      status = await gateway.status();
      expect(submits).toHaveLength(2);
      expect(status.counts).toMatchObject({ pending: 0, sent: 1, failed: 0 });
      expect((await gateway.findPublished("act_1"))?.gatewayEventId).toBe("b".repeat(64));
    } finally {
      await cleanup();
    }
  });

  it("fails a rejected write immediately and reports it", async () => {
    const { client, submits } = recordingClient({
      submit: () => new ActivityGatewayRequestError("Activity gateway returned 400", false),
    });
    const { gateway, cleanup } = await createGateway(client);
    try {
      await gateway.trySend(await gateway.enqueuePublish(APPROVAL));
      await gateway.processDue();

      expect(submits).toHaveLength(1);
      const status = await gateway.status();
      expect(status.counts).toMatchObject({ pending: 0, sent: 0, failed: 1 });
      expect(status.recentFailures[0]).toMatchObject({
        operation: "publish",
        idempotencyKey: "proposal-approved:p1:1",
        attempts: 1,
      });
      expect(status.recentFailures[0]?.lastError).toContain("400");
    } finally {
      await cleanup();
    }
  });

  it("retracts a published event with its Activity event ID", async () => {
    const { client, retracts } = recordingClient();
    const { gateway, cleanup } = await createGateway(client);
    try {
      await gateway.trySend(await gateway.enqueuePublish(APPROVAL));
      await gateway.trySend(
        await gateway.enqueueRetract({ legacyEventId: "act_1", reason: "Approval revoked" }),
      );

      expect(retracts).toEqual([
        {
          eventId: `${"a".repeat(63)}1`,
          reason: "Approval revoked",
          idempotencyKey: "retract:proposal-approved:p1:1",
        },
      ]);
      expect((await gateway.status()).counts).toMatchObject({ sent: 2, pending: 0, failed: 0 });
    } finally {
      await cleanup();
    }
  });

  it("waits to retract until the publish has reached Activity", async () => {
    let clock = new Date("2026-09-16T00:00:00.000Z");
    const { client, submits, retracts } = recordingClient({
      submit: (_call, index) =>
        index === 0
          ? new ActivityGatewayRequestError("Activity gateway is unreachable", true)
          : { eventId: "c".repeat(64) },
    });
    const { gateway, cleanup } = await createGateway(client, { now: () => clock });
    try {
      await gateway.trySend(await gateway.enqueuePublish(APPROVAL));
      await gateway.trySend(
        await gateway.enqueueRetract({ legacyEventId: "act_1", reason: "Approval revoked" }),
      );
      expect(retracts).toHaveLength(0);
      expect((await gateway.status()).counts).toMatchObject({ pending: 2, sent: 0 });

      clock = new Date(clock.getTime() + 60_000);
      await gateway.processDue();

      expect(submits).toHaveLength(2);
      expect(retracts).toEqual([
        {
          eventId: "c".repeat(64),
          reason: "Approval revoked",
          idempotencyKey: "retract:proposal-approved:p1:1",
        },
      ]);
      expect((await gateway.status()).counts).toMatchObject({ pending: 0, sent: 2, failed: 0 });
    } finally {
      await cleanup();
    }
  });

  it("ignores a retract for an event that was never forwarded", async () => {
    const { client, retracts } = recordingClient();
    const { gateway, cleanup } = await createGateway(client);
    try {
      const row = await gateway.enqueueRetract({ legacyEventId: "act_missing", reason: "gone" });
      expect(row).toBeNull();
      await gateway.trySend(row);
      expect(retracts).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("reports an unconfigured gateway and keeps work pending", async () => {
    const { gateway, cleanup } = await createGateway(null);
    try {
      await gateway.trySend(await gateway.enqueuePublish(APPROVAL));
      const status = await gateway.status();
      expect(status.configured).toBe(false);
      expect(status.counts).toMatchObject({ pending: 1, sent: 0, failed: 0 });
      expect(status.oldestPendingAt).not.toBeNull();
    } finally {
      await cleanup();
    }
  });
});

describe("http gateway client", () => {
  function clientWith(response: Response | Error) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = createHttpActivityGatewayClient({
      baseUrl: "https://activity.example/api/",
      apiKey: "act_secret",
      fetchImplementation: (async (url: string, init: RequestInit) => {
        calls.push({ url: String(url), init });
        if (response instanceof Error) throw response;
        return response;
      }) as unknown as typeof fetch,
    });
    return { client, calls };
  }

  it("submits with the API key and returns the event ID", async () => {
    const { client, calls } = clientWith(
      new Response(JSON.stringify({ eventId: "d".repeat(64) }), { status: 200 }),
    );

    await expect(
      client.submit({
        eventType: "project.approved",
        actor: "alice.near",
        idempotencyKey: "k1",
        payload: {},
      }),
    ).resolves.toEqual({ eventId: "d".repeat(64) });
    expect(calls[0]?.url).toBe("https://activity.example/api/v1/events");
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(
      "Bearer act_secret",
    );
  });

  it("marks server errors retryable and client errors permanent", async () => {
    const retryable = clientWith(new Response("busy", { status: 503 }));
    await expect(
      retryable.client.submit({
        eventType: "project.approved",
        actor: "a.near",
        idempotencyKey: "k",
        payload: {},
      }),
    ).rejects.toMatchObject({ retryable: true });

    const permanent = clientWith(new Response("bad actor", { status: 400 }));
    await expect(
      permanent.client.submit({
        eventType: "project.approved",
        actor: "a.near",
        idempotencyKey: "k",
        payload: {},
      }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("treats a network failure as retryable and posts retractions to the event path", async () => {
    const offline = clientWith(new Error("connect ECONNREFUSED"));
    await expect(
      offline.client.retract({ eventId: "e".repeat(64), reason: "r", idempotencyKey: "k" }),
    ).rejects.toMatchObject({ retryable: true });

    const ok = clientWith(new Response("", { status: 200 }));
    await ok.client.retract({ eventId: "e".repeat(64), reason: "r", idempotencyKey: "k" });
    expect(ok.calls[0]?.url).toBe(
      `https://activity.example/api/v1/events/${"e".repeat(64)}/retract`,
    );
  });
});
