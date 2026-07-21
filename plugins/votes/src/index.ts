import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { VoteService, VoteServiceLive } from "./services/votes";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    VOTES_DATABASE_URL: z.string().default("pglite:.bos/votes/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.VOTES_DATABASE_URL);
      const Votes = VoteServiceLive.pipe(Layer.provide(Database));
      const voteService = yield* tools.buildService(VoteService, Votes);

      return { voteService };
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
        const iterator = services.voteService.publisher.subscribe("vote", { signal, lastEventId });
        for await (const event of iterator) {
          yield event;
        }
      }),
    };
  },
});
