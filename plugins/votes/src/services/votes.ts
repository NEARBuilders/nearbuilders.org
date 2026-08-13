import { and, count, desc, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { MemoryPublisher } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { VoteEventSchema } from "../contract";
import { DatabaseTag } from "../db/layer";
import { upvotes } from "../db/schema";

type VoteEventDetail = z.infer<typeof VoteEventSchema>;

type VoteEvents = {
  vote: VoteEventDetail;
};

function generateId(): string {
  return `uv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createVoteMethods(db: any, publisher: MemoryPublisher<VoteEvents>) {
  return {
    async upvote(entityId: string, userId: string) {
      try {
        await db.insert(upvotes).values({
          id: generateId(),
          entityId,
          userId,
        });
      } catch (error) {
        const [existing] = await db
          .select({ id: upvotes.id })
          .from(upvotes)
          .where(and(eq(upvotes.entityId, entityId), eq(upvotes.userId, userId)))
          .limit(1);
        if (!existing) throw error;
      }

      const [result] = await db
        .select({ count: count() })
        .from(upvotes)
        .where(eq(upvotes.entityId, entityId));

      const totalCount = result?.count ?? 0;

      await publisher.publish("vote", {
        type: "upvote",
        entityId,
        userId,
        timestamp: new Date().toISOString(),
        totalCount,
      });

      return { entityId, userId, totalCount };
    },

    async downvote(entityId: string, userId: string) {
      await db
        .delete(upvotes)
        .where(and(eq(upvotes.entityId, entityId), eq(upvotes.userId, userId)));

      const [result] = await db
        .select({ count: count() })
        .from(upvotes)
        .where(eq(upvotes.entityId, entityId));

      const totalCount = result?.count ?? 0;

      await publisher.publish("vote", {
        type: "downvote",
        entityId,
        userId,
        timestamp: new Date().toISOString(),
        totalCount,
      });

      return { entityId, totalCount };
    },

    async getUpvoteCount(entityId: string) {
      const [result] = await db
        .select({ count: count() })
        .from(upvotes)
        .where(eq(upvotes.entityId, entityId));

      return { entityId, totalCount: result?.count ?? 0 };
    },

    async getUserVote(entityId: string, userId: string) {
      const [result] = await db
        .select({ count: count() })
        .from(upvotes)
        .where(and(eq(upvotes.entityId, entityId), eq(upvotes.userId, userId)));
      return { entityId, hasUpvote: (result?.count ?? 0) > 0 };
    },

    async getUpvoteCounts(entityIds: string[]) {
      if (entityIds.length === 0) return {};
      const results = await db
        .select({
          entityId: upvotes.entityId,
          count: count(),
        })
        .from(upvotes)
        .where(inArray(upvotes.entityId, entityIds))
        .groupBy(upvotes.entityId);

      const map: Record<string, { entityId: string; totalCount: number }> = {};
      for (const entityId of entityIds) {
        const found = results.find(
          (r: { entityId: string; count: number }) => r.entityId === entityId,
        );
        map[entityId] = { entityId, totalCount: found?.count ?? 0 };
      }
      return map;
    },

    async getUserVotes(entityIds: string[], userId: string) {
      if (entityIds.length === 0) return {};
      const results = await db
        .select({
          entityId: upvotes.entityId,
          count: count(),
        })
        .from(upvotes)
        .where(and(inArray(upvotes.entityId, entityIds), eq(upvotes.userId, userId)))
        .groupBy(upvotes.entityId);

      const map: Record<string, { entityId: string; hasUpvote: boolean }> = {};
      for (const entityId of entityIds) {
        const found = results.find(
          (r: { entityId: string; count: number }) => r.entityId === entityId,
        );
        map[entityId] = { entityId, hasUpvote: (found?.count ?? 0) > 0 };
      }
      return map;
    },

    async getUpvoteFeed(limit = 50, _cursor?: string) {
      const pageLimit = Math.min(limit, 100);
      const records = await db
        .select()
        .from(upvotes)
        .orderBy(desc(upvotes.createdAt))
        .limit(pageLimit + 1);

      const hasMore = records.length > pageLimit;
      const data = records.slice(0, pageLimit).map((r: any) => ({
        id: r.id,
        entityId: r.entityId,
        userId: r.userId,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      }));

      return {
        data,
        meta: {
          total: data.length,
          hasMore,
          nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
        },
      };
    },
  };
}

type VoteMethods = ReturnType<typeof createVoteMethods>;

export class VoteService extends Context.Tag("votes/VoteService")<
  VoteService,
  VoteMethods & { publisher: MemoryPublisher<VoteEvents> }
>() {}

export const VoteServiceLive = Layer.effect(
  VoteService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;
    const publisher = new MemoryPublisher<VoteEvents>({ resumeRetentionSeconds: 120 });
    const methods = createVoteMethods(db, publisher);
    return { ...methods, publisher };
  }),
);
