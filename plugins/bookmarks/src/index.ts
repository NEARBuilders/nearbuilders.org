import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
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

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.BOOKMARKS_DATABASE_URL);
      const Bookmarks = BookmarkServiceLive.pipe(Layer.provide(Database));
      const bookmarkService = yield* tools.buildService(BookmarkService, Bookmarks);

      return { bookmarkService };
    }),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    return {
      bookmark: builder.bookmark.use(requireAuth).handler(async ({ input, context }) => {
        return await services.bookmarkService.bookmark(input.entityId, context.userId!);
      }),
      unbookmark: builder.unbookmark.use(requireAuth).handler(async ({ input, context }) => {
        return await services.bookmarkService.unbookmark(input.entityId, context.userId!);
      }),
      getUserBookmark: builder.getUserBookmark
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await services.bookmarkService.getUserBookmark(input.entityId, context.userId!);
        }),
    };
  },
});
