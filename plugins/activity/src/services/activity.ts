import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { ActivityEventSchema, ActivityFeedInputSchema } from "../contract";
import type { Database } from "../db";
import { DatabaseTag } from "../db/layer";
import { activityEvents } from "../db/schema";

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type ActivityFeedInput = z.infer<typeof ActivityFeedInputSchema>;

function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function rowToActivity(row: typeof activityEvents.$inferSelect): ActivityEvent {
  return {
    id: row.id,
    source: row.source,
    type: row.type,
    actor: row.actor,
    payload: row.payload,
    verified: row.verified,
    hiddenAt: row.hiddenAt
      ? row.hiddenAt instanceof Date
        ? row.hiddenAt.toISOString()
        : String(row.hiddenAt)
      : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export const SELF_REPORTED_SOURCE = "manual";

function filterWhere(input: { source?: string; type?: string; actor?: string; since?: Date }) {
  const conditions = [isNull(activityEvents.hiddenAt)] as any[];
  if (input.source) conditions.push(eq(activityEvents.source, input.source));
  if (input.type) conditions.push(eq(activityEvents.type, input.type));
  if (input.actor) conditions.push(eq(activityEvents.actor, input.actor));
  if (input.since) conditions.push(gte(activityEvents.createdAt, input.since));
  return and(...conditions);
}

export function createActivityMethods(db: Database) {
  return {
    emitActivity: (input: {
      source: string;
      type: string;
      actor: string;
      payload: unknown;
      verified: boolean;
      idempotencyKey?: string;
    }) =>
      Effect.gen(function* () {
        const [created] = yield* Effect.promise(() =>
          db
            .insert(activityEvents)
            .values({
              id: generateId(),
              source: input.source,
              type: input.type,
              actor: input.actor,
              payload: input.payload === undefined ? null : input.payload,
              verified: input.verified,
              idempotencyKey: input.idempotencyKey ?? null,
              hiddenAt: null,
            })
            .onConflictDoUpdate({
              target: activityEvents.idempotencyKey,
              set: { hiddenAt: null },
            })
            .returning(),
        );

        if (!created) {
          return yield* Effect.fail(
            new ORPCError("INTERNAL_SERVER_ERROR", {
              message: "Could not emit activity",
            }),
          );
        }

        return rowToActivity(created);
      }),

    hideActivity: (id: string) =>
      Effect.gen(function* () {
        const [updated] = yield* Effect.promise(() =>
          db
            .update(activityEvents)
            .set({ hiddenAt: new Date() })
            .where(eq(activityEvents.id, id))
            .returning(),
        );
        if (!updated) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Activity event not found" }),
          );
        }
        return rowToActivity(updated);
      }),

    getActivityFeed: (input: ActivityFeedInput) =>
      Effect.gen(function* () {
        const limit = Math.min(input.limit ?? 50, 100);
        const offset = input.cursor ? Math.max(Number.parseInt(input.cursor, 10) || 0, 0) : 0;
        const where = filterWhere(input);

        const counted = yield* Effect.promise(() =>
          db.select({ count: count() }).from(activityEvents).where(where),
        );
        const total = counted[0]?.count ?? 0;

        const rows = yield* Effect.promise(() =>
          db
            .select()
            .from(activityEvents)
            .where(where)
            .orderBy(desc(activityEvents.createdAt))
            .limit(limit)
            .offset(offset),
        );

        const nextOffset = offset + limit;
        const hasMore = nextOffset < total;

        return {
          data: rows.map(rowToActivity),
          meta: {
            total,
            hasMore,
            nextCursor: hasMore ? String(nextOffset) : null,
          },
        };
      }),
  };
}

export class ActivityService extends Context.Tag("activity/ActivityService")<
  ActivityService,
  ReturnType<typeof createActivityMethods>
>() {}

export const ActivityServiceLive = Layer.effect(
  ActivityService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;
    return createActivityMethods(db);
  }),
);
