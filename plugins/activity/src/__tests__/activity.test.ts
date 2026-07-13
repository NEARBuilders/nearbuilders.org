import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { describe, expect, it } from "vitest";
import { createDatabaseDriver } from "../db";
import { createActivityMethods } from "../services/activity";

async function createService() {
  const dataDir = await mkdtemp(join(tmpdir(), "nearbuilders-activity-"));
  const driver = await createDatabaseDriver(`pglite:${dataDir}`);
  await driver.db.execute(sql`
    DROP TABLE IF EXISTS "activity_events"
  `);
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
  return {
    activity: createActivityMethods(driver.db),
    cleanup: async () => {
      await driver.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

describe("activity service", () => {
  it("emits events, filters the feed, and ranks verified activity higher", async () => {
    const { activity, cleanup } = await createService();

    try {
      const manual = await Effect.runPromise(
        activity.emitActivity({
          source: "manual",
          type: "upload",
          actor: "alice.near",
          payload: { title: "Demo" },
          verified: false,
        }),
      );
      await Effect.runPromise(
        activity.emitActivity({
          source: "github",
          type: "pr",
          actor: "alice.near",
          payload: { number: 1 },
          verified: true,
          idempotencyKey: "github:1",
        }),
      );
      await Effect.runPromise(
        activity.emitActivity({
          source: "manual",
          type: "claim",
          actor: "bob.near",
          payload: {},
          verified: false,
        }),
      );

      const feed = await Effect.runPromise(activity.getActivityFeed({ actor: "alice.near" }));
      const leaderboard = await Effect.runPromise(
        activity.getLeaderboard({ period: "all-time", limit: 10 }),
      );

      expect(manual.verified).toBe(false);
      expect(feed.data).toHaveLength(2);
      expect(leaderboard[0]).toMatchObject({
        actor: "alice.near",
        eventCount: 2,
        endorsementScore: 3,
        topSources: ["github", "manual"],
      });

      const duplicate = await Effect.runPromise(
        activity.emitActivity({
          source: "github",
          type: "pr",
          actor: "alice.near",
          payload: { number: 1 },
          verified: true,
          idempotencyKey: "github:1",
        }),
      );
      await Effect.runPromise(activity.hideActivity(duplicate.id));
      const hiddenFeed = await Effect.runPromise(activity.getActivityFeed({ actor: "alice.near" }));
      const hiddenLeaderboard = await Effect.runPromise(
        activity.getLeaderboard({ period: "all-time", limit: 10 }),
      );

      expect(duplicate.id).not.toBe(manual.id);
      expect(hiddenFeed.data).toHaveLength(1);
      expect(hiddenLeaderboard[0]).toMatchObject({ eventCount: 1, endorsementScore: 1 });
    } finally {
      await cleanup();
    }
  }, 20_000);
});
