import { ORPCError } from "@orpc/server";
import { Context, Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
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

  initialize: (config) =>
    Effect.sync(() =>
      VoteServiceLive.pipe(Layer.provide(DatabaseLive(config.secrets.VOTES_DATABASE_URL))),
    ),

  createRouter: (builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    return {
      upvote: builder.upvote.use(requireAuth).effect(function* ({ input, context }) {
        const votes = yield* VoteService;
        return yield* Effect.promise(() => votes.upvote(input.entityId, context.userId!));
      }),
      downvote: builder.downvote.use(requireAuth).effect(function* ({ input, context }) {
        const votes = yield* VoteService;
        return yield* Effect.promise(() => votes.downvote(input.entityId, context.userId!));
      }),
      getUpvoteCount: builder.getUpvoteCount.effect(function* ({ input }) {
        const votes = yield* VoteService;
        return yield* Effect.promise(() => votes.getUpvoteCount(input.entityId));
      }),
      getUserVote: builder.getUserVote.use(requireAuth).effect(function* ({ input, context }) {
        const votes = yield* VoteService;
        return yield* Effect.promise(() => votes.getUserVote(input.entityId, context.userId!));
      }),
      getUserVotes: builder.getUserVotes.use(requireAuth).effect(function* ({ input, context }) {
        const votes = yield* VoteService;
        return yield* Effect.promise(() => votes.getUserVotes(input.entityIds, context.userId!));
      }),
      getUpvoteCounts: builder.getUpvoteCounts.effect(function* ({ input }) {
        const votes = yield* VoteService;
        return yield* Effect.promise(() => votes.getUpvoteCounts(input.entityIds));
      }),
      getUpvoteFeed: builder.getUpvoteFeed.effect(function* ({ input }) {
        const votes = yield* VoteService;
        return yield* Effect.promise(() => votes.getUpvoteFeed(input.limit, input.cursor));
      }),
      subscribe: builder.subscribe.handler(async function* ({ context, signal, lastEventId }) {
        const votes = Context.get(context["effect/context"], VoteService);
        const iterator = votes.publisher.subscribe("vote", { signal, lastEventId });
        for await (const event of iterator) {
          yield event;
        }
      }),
    };
  },
});
