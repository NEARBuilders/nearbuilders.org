import { and, count, desc, eq } from "drizzle-orm";
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract, type VoteEventSchema } from "./contract";
import { upvotes } from "./db/schema";

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

  context: z.object({
    userId: z.string().optional(),
    user: z
      .object({
        id: z.string(),
        role: z.string().optional(),
        email: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    reqHeaders: z.custom<Headers>().optional(),
    getRawBody: z.custom<() => Promise<string>>().optional(),
  }),

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
