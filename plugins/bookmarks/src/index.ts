import { createPlugin } from "every-plugin";
import { Effect, Layer } from "effect";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { BookmarkService, BookmarkServiceLive } from "./services/bookmarks";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    BOOKMARKS_DATABASE_URL: z.string().default("pglite:.bos/bookmarks/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.sync(() =>
      BookmarkServiceLive.pipe(Layer.provide(DatabaseLive(config.secrets.BOOKMARKS_DATABASE_URL))),
    ),

  createRouter: (builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    return {
      bookmark: builder.bookmark.use(requireAuth).effect(function* ({ input, context }) {
        const bookmarks = yield* BookmarkService;
        return yield* Effect.promise(() => bookmarks.bookmark(input.entityId, context.userId!));
      }),
      unbookmark: builder.unbookmark.use(requireAuth).effect(function* ({ input, context }) {
        const bookmarks = yield* BookmarkService;
        return yield* Effect.promise(() => bookmarks.unbookmark(input.entityId, context.userId!));
      }),
      getUserBookmark: builder.getUserBookmark
        .use(requireAuth)
        .effect(function* ({ input, context }) {
          const bookmarks = yield* BookmarkService;
          return yield* Effect.promise(() =>
            bookmarks.getUserBookmark(input.entityId, context.userId!),
          );
        }),
    };
  },
});
