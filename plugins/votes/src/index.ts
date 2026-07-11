import { and, count, desc, eq, inArray } from "drizzle-orm";
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract, type VoteEventSchema } from "./contract";
import { upvotes } from "./db/schema";
import { ContextSchema } from "./lib/context";

type VoteEventDetail = z.infer<typeof VoteEventSchema>;

type VoteEvents = {
  vote: VoteEventDetail;
};

function generateId(): string {
  return `uv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createVoteService(db: any, publisher: MemoryPublisher<VoteEvents>) {
  return {
    async upvote(entityId: string, userId: string) {
      try {
        await db.insert(upvotes).values({
          id: generateId(),
          entityId,
          userId,
        });
      } catch {
        // unique constraint violation - already upvoted
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

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    VOTES_DATABASE_URL: z.string().default("pglite:.bos/votes/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.promise(async () => {
      const { createDatabaseDriver } = await import("./db/index");
      const driver = await createDatabaseDriver(config.secrets.VOTES_DATABASE_URL);
      const migrations = await import("virtual:drizzle-migrations.sql");
      const { migrate } = await import("./db/migrator");
      await migrate(driver.db, migrations.default);
      const publisher = new MemoryPublisher<VoteEvents>({ resumeRetentionSeconds: 120 });
      const voteService = createVoteService(driver.db, publisher);
      console.log("[Votes] Services Initialized");
      return { voteService, publisher, driver };
    }),

  shutdown: (services) =>
    Effect.promise(async () => {
      console.log("[Votes] Shutdown");
      await services.driver.close();
    }),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    return {
      upvote: builder.upvote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.voteService.upvote(input.entityId, context.userId!);
      }),
      downvote: builder.downvote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.voteService.downvote(input.entityId, context.userId!);
      }),
      getUpvoteCount: builder.getUpvoteCount.handler(async ({ input }) => {
        return await services.voteService.getUpvoteCount(input.entityId);
      }),
      getUserVote: builder.getUserVote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.voteService.getUserVote(input.entityId, context.userId!);
      }),
      getUserVotes: builder.getUserVotes.use(requireAuth).handler(async ({ input, context }) => {
        return await services.voteService.getUserVotes(input.entityIds, context.userId!);
      }),
      getUpvoteCounts: builder.getUpvoteCounts.handler(async ({ input }) => {
        return await services.voteService.getUpvoteCounts(input.entityIds);
      }),
      getUpvoteFeed: builder.getUpvoteFeed.handler(async ({ input }) => {
        return await services.voteService.getUpvoteFeed(input.limit, input.cursor);
      }),
      subscribe: builder.subscribe.handler(async function* ({ signal, lastEventId }) {
        const iterator = services.publisher.subscribe("vote", { signal, lastEventId });
        for await (const event of iterator) {
          yield event;
        }
      }),
    };
  },
});
