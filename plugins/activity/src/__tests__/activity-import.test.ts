import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDatabaseDriver } from "../db";
import { activityEvents } from "../db/schema";
import { createActivityGatewayMethods } from "../services/activity-gateway";
import {
  createActivityImportMethods,
  importIdempotencyKey,
  importPayload,
} from "../services/activity-import";

const NOW = new Date("2026-09-16T12:00:00.000Z"); // a Wednesday

async function createImport() {
  const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-activity-import-"));
  const driver = await createDatabaseDriver(`pglite:${dataDir}`);
  await driver.db.execute(sql`
    CREATE TABLE "activity_events" (
      "id" text PRIMARY KEY NOT NULL,
      "source" text NOT NULL,
      "type" text NOT NULL,
      "actor" text NOT NULL,
      "payload" jsonb NOT NULL,
      "verified" boolean DEFAULT false NOT NULL,
      "idempotency_key" text UNIQUE,
      "hidden_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
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

  const submits: Array<{ idempotencyKey: string; payload: unknown; eventType: string }> = [];
  const retracts: string[] = [];
  const gateway = createActivityGatewayMethods(
    driver.db,
    {
      async submit(call) {
        submits.push(call);
        return { eventId: `${"a".repeat(62)}${String(submits.length).padStart(2, "0")}` };
      },
      async retract(call) {
        retracts.push(call.eventId);
      },
    },
    { now: () => NOW },
  );

  return {
    db: driver.db,
    submits,
    retracts,
    gateway,
    history: createActivityImportMethods(driver.db, gateway, { now: () => NOW }),
    cleanup: async () => {
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

async function seed(db: Awaited<ReturnType<typeof createImport>>["db"]) {
  await db.insert(activityEvents).values([
    {
      id: "act_old_project",
      source: "projects",
      type: "approved",
      actor: "alice.near",
      payload: { proposalId: "p1" },
      verified: true,
      idempotencyKey: "proposal-approved:p1:1",
      hiddenAt: null,
      createdAt: new Date("2026-03-02T10:00:00.000Z"),
    },
    {
      id: "act_no_key",
      source: "nearcatalog",
      type: "claim",
      actor: "bob.near",
      payload: { entityId: "e1" },
      verified: true,
      idempotencyKey: null,
      hiddenAt: null,
      createdAt: new Date("2026-08-31T10:00:00.000Z"),
    },
    {
      id: "act_hidden",
      source: "builders",
      type: "approved",
      actor: "carol.near",
      payload: { proposalId: "b1" },
      verified: true,
      idempotencyKey: "proposal-approved:b1:1",
      hiddenAt: new Date("2026-09-01T10:00:00.000Z"),
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
    },
    {
      id: "act_manual",
      source: "manual",
      type: "upload",
      actor: "dave.near",
      payload: { link: "x" },
      verified: false,
      idempotencyKey: null,
      hiddenAt: null,
      createdAt: new Date("2026-09-15T10:00:00.000Z"),
    },
  ]);
}

describe("activity history import", () => {
  it("reports what would be imported without sending anything", async () => {
    const context = await createImport();
    try {
      await seed(context.db);

      const plan = await context.history.plan();

      expect(plan).toMatchObject({
        dryRun: true,
        scanned: 4,
        eligible: 3,
        alreadyForwarded: 0,
        toImport: 3,
        hidden: 1,
        synthesizedKeys: 1,
        enqueued: 0,
        enqueuedRetractions: 0,
        oldestOccurredAt: "2026-03-02T10:00:00.000Z",
        newestOccurredAt: "2026-08-31T10:00:00.000Z",
      });
      expect(plan.skippedByType).toEqual([{ source: "manual", type: "upload", count: 1 }]);
      expect(plan.timestamps).toMatchObject({
        preserved: false,
        olderThanCurrentWeek: 3,
        olderThanCurrentMonth: 3,
      });
      expect(context.submits).toHaveLength(0);
    } finally {
      await context.cleanup();
    }
  });

  it("imports each event once, keeping its original time in the payload", async () => {
    const context = await createImport();
    try {
      await seed(context.db);

      const first = await context.history.plan({ dryRun: false });
      expect(first).toMatchObject({ toImport: 3, enqueued: 3, enqueuedRetractions: 1 });
      expect(context.submits.map(({ idempotencyKey }) => idempotencyKey)).toEqual([
        "proposal-approved:p1:1",
        "proposal-approved:b1:1",
        "legacy:act_no_key",
      ]);
      expect(context.submits[0]?.payload).toMatchObject({
        proposalId: "p1",
        legacyEventId: "act_old_project",
        occurredAt: "2026-03-02T10:00:00.000Z",
      });
      expect(context.submits.map(({ eventType }) => eventType)).toEqual([
        "project.approved",
        "builder.approved",
        "nearcatalog.claim",
      ]);
      expect(context.retracts).toHaveLength(1);

      const second = await context.history.plan({ dryRun: false });
      expect(second).toMatchObject({ toImport: 0, alreadyForwarded: 3, enqueued: 0 });
      expect(context.submits).toHaveLength(3);
    } finally {
      await context.cleanup();
    }
  });

  it("limits a first pass and resumes from a date", async () => {
    const context = await createImport();
    try {
      await seed(context.db);

      const limited = await context.history.plan({ dryRun: false, limit: 1 });
      expect(limited).toMatchObject({ toImport: 1, enqueued: 1 });

      const since = await context.history.plan({ since: new Date("2026-08-01T00:00:00.000Z") });
      expect(since).toMatchObject({ scanned: 2, eligible: 1, toImport: 1 });
    } finally {
      await context.cleanup();
    }
  });

  it("derives stable keys and payload metadata", () => {
    expect(importIdempotencyKey({ id: "act_1", idempotencyKey: null })).toBe("legacy:act_1");
    expect(importIdempotencyKey({ id: "act_1", idempotencyKey: "keep" })).toBe("keep");
    expect(
      importPayload({
        id: "act_1",
        payload: "not-an-object",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        hiddenAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
    ).toEqual({
      value: "not-an-object",
      legacyEventId: "act_1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      legacyHiddenAt: "2026-02-01T00:00:00.000Z",
    });
  });
});
