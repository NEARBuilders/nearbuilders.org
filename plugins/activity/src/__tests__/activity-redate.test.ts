import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabaseDriver } from "../db";
import { activityEvents, activityGatewayOutbox } from "../db/schema";
import {
  type ActivityGatewayClient,
  ActivityGatewayRequestError,
  createActivityGatewayMethods,
} from "../services/activity-gateway";

const OLD_ID = "a".repeat(64);
const LIVE_ID = "b".repeat(64);
const HIDDEN_ID = "c".repeat(64);
const NEW_ID = "d".repeat(64);

type SubmitCall = Parameters<ActivityGatewayClient["submit"]>[0];
type RetractCall = Parameters<ActivityGatewayClient["retract"]>[0];

async function setup(submit?: (call: SubmitCall) => { eventId: string } | Error) {
  const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-activity-redate-"));
  const driver = await createDatabaseDriver(`pglite:${dataDir}`);
  await driver.db.execute(sql`
    CREATE TABLE "activity_settings" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await driver.db.execute(sql`
    CREATE TABLE "activity_events" (
      "id" text PRIMARY KEY NOT NULL,
      "source" text NOT NULL,
      "type" text NOT NULL,
      "actor" text NOT NULL,
      "payload" jsonb NOT NULL,
      "verified" boolean DEFAULT false NOT NULL,
      "idempotency_key" text,
      "hidden_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
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
      "occurred_at" timestamp with time zone,
      "superseded_at" timestamp with time zone,
      "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await driver.db.execute(sql`
    CREATE UNIQUE INDEX "activity_gateway_outbox_operation_key_unique"
      ON "activity_gateway_outbox" ("operation", "idempotency_key")
  `);

  const legacy = [
    { id: "act_old", key: "proposal-approved:p1:1", at: "2026-07-10T09:00:00.000Z", hidden: null },
    { id: "act_live", key: "proposal-approved:p2:1", at: "2026-09-20T09:00:00.000Z", hidden: null },
    {
      id: "act_hidden",
      key: "proposal-approved:p3:1",
      at: "2026-07-12T09:00:00.000Z",
      hidden: "2026-07-13T09:00:00.000Z",
    },
  ];
  await driver.db.insert(activityEvents).values(
    legacy.map((row) => ({
      id: row.id,
      source: "projects",
      type: "approved",
      actor: "alice.near",
      payload: { proposalId: row.key },
      verified: true,
      idempotencyKey: row.key,
      hiddenAt: row.hidden ? new Date(row.hidden) : null,
      createdAt: new Date(row.at),
    })),
  );
  const forwardedAt = {
    act_old: "2026-09-18T12:00:00.000Z",
    act_live: "2026-09-20T09:00:05.000Z",
    act_hidden: "2026-09-18T12:00:00.000Z",
  } as const;
  const gatewayIds = { act_old: OLD_ID, act_live: LIVE_ID, act_hidden: HIDDEN_ID } as const;
  await driver.db.insert(activityGatewayOutbox).values(
    legacy.map((row) => ({
      id: `outbox_${row.id}`,
      operation: "publish",
      legacyEventId: row.id,
      idempotencyKey: row.key,
      legacySource: "projects",
      legacyType: "approved",
      eventType: "project.approved",
      actor: "alice.near",
      payload: { proposalId: row.key },
      status: "sent",
      attempts: 1,
      gatewayEventId: gatewayIds[row.id as keyof typeof gatewayIds],
      createdAt: new Date(forwardedAt[row.id as keyof typeof forwardedAt]),
      updatedAt: new Date(forwardedAt[row.id as keyof typeof forwardedAt]),
    })),
  );

  const submits: SubmitCall[] = [];
  const retracts: RetractCall[] = [];
  const client: ActivityGatewayClient = {
    async submit(call) {
      submits.push(call);
      const result = submit?.(call) ?? { eventId: NEW_ID };
      if (result instanceof Error) throw result;
      return result;
    },
    async retract(call) {
      retracts.push(call);
    },
  };
  const gateway = createActivityGatewayMethods(driver.db, client, {
    now: () => new Date("2026-10-14T00:00:00.000Z"),
  });
  return {
    gateway,
    submits,
    retracts,
    cleanup: async () => {
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

describe("re-dating imported history", () => {
  it("reports only events forwarded long after they happened, skipping hidden ones", async () => {
    const { gateway, submits, cleanup } = await setup();
    try {
      await expect(gateway.redate()).resolves.toEqual({
        dryRun: true,
        misdated: 1,
        hidden: 1,
        enqueued: 0,
        oldestOccurredAt: "2026-07-10T09:00:00.000Z",
        newestOccurredAt: "2026-07-10T09:00:00.000Z",
      });
      await gateway.processDue();
      expect(submits).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("re-sends with the original time, then retracts exactly the old copy", async () => {
    const { gateway, submits, retracts, cleanup } = await setup();
    try {
      await expect(gateway.redate({ dryRun: false })).resolves.toMatchObject({ enqueued: 1 });

      await gateway.processDue();
      expect(submits).toEqual([
        {
          eventType: "project.approved",
          actor: "alice.near",
          idempotencyKey: "proposal-approved:p1:1:dated",
          payload: { proposalId: "proposal-approved:p1:1" },
          occurredAt: "2026-07-10T09:00:00.000Z",
        },
      ]);

      await gateway.processDue();
      expect(retracts).toEqual([
        {
          eventId: OLD_ID,
          reason: "Re-sent with its original time",
          idempotencyKey: "retract:proposal-approved:p1:1",
        },
      ]);

      const current = await gateway.findPublished("act_old");
      expect(current?.gatewayEventId).toBe(NEW_ID);
      const legacyIds = await gateway.legacyIdsFor([OLD_ID, NEW_ID, LIVE_ID]);
      expect(Object.fromEntries(legacyIds)).toEqual({
        [OLD_ID]: "act_old",
        [NEW_ID]: "act_old",
        [LIVE_ID]: "act_live",
      });

      await expect(gateway.redate()).resolves.toMatchObject({ misdated: 0 });
    } finally {
      await cleanup();
    }
  });

  it("keeps the old copy when Activity rejects the replacement", async () => {
    const { gateway, retracts, cleanup } = await setup(
      () => new ActivityGatewayRequestError("Activity gateway returned 400", false),
    );
    try {
      await gateway.redate({ dryRun: false });
      await gateway.processDue();
      await gateway.processDue();

      expect(retracts).toHaveLength(0);
      const current = await gateway.findPublished("act_old");
      expect(current?.gatewayEventId).toBe(OLD_ID);
      const status = await gateway.status();
      expect(status.recentFailures[0]).toMatchObject({
        idempotencyKey: "proposal-approved:p1:1:dated",
      });
    } finally {
      await cleanup();
    }
  });

  it("hides the current copy when nearbuilders.org hides a re-dated event", async () => {
    const { gateway, retracts, cleanup } = await setup();
    try {
      await gateway.redate({ dryRun: false });
      await gateway.processDue();
      await gateway.processDue();
      retracts.length = 0;

      await gateway.trySend(
        await gateway.enqueueRetract({ legacyEventId: "act_old", reason: "Hidden" }),
      );
      expect(retracts).toEqual([
        {
          eventId: NEW_ID,
          reason: "Hidden",
          idempotencyKey: "retract:proposal-approved:p1:1:dated",
        },
      ]);
    } finally {
      await cleanup();
    }
  });

  it("also hides the replacement when the event was hidden while it was queued", async () => {
    const { gateway, retracts, cleanup } = await setup();
    try {
      await gateway.redate({ dryRun: false });
      await gateway.trySend(
        await gateway.enqueueRetract({ legacyEventId: "act_old", reason: "Hidden" }),
      );
      expect(retracts.map(({ eventId }) => eventId)).toEqual([OLD_ID]);

      await gateway.processDue();
      await gateway.processDue();
      expect(retracts.map(({ eventId }) => eventId)).toEqual([OLD_ID, NEW_ID]);
    } finally {
      await cleanup();
    }
  });
});
