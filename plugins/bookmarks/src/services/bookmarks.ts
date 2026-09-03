import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { DatabaseTag } from "../db/layer";
import { bookmarks } from "../db/schema";

function generateId(): string {
  return `bm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createBookmarkMethods(db: any) {
  return {
    async bookmark(entityId: string, userId: string) {
      try {
        await db.insert(bookmarks).values({
          id: generateId(),
          entityId,
          userId,
        });
      } catch {}

      return { entityId, userId };
    },

    async unbookmark(entityId: string, userId: string) {
      await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.entityId, entityId), eq(bookmarks.userId, userId)));

      return { entityId };
    },

    async getUserBookmark(entityId: string, userId: string) {
      const [result] = await db
        .select({ id: bookmarks.id })
        .from(bookmarks)
        .where(and(eq(bookmarks.entityId, entityId), eq(bookmarks.userId, userId)));

      return { entityId, isBookmarked: Boolean(result) };
    },
  };
}

type BookmarkMethods = ReturnType<typeof createBookmarkMethods>;

export class BookmarkService extends Context.Tag("bookmarks/BookmarkService")<
  BookmarkService,
  BookmarkMethods
>() {}

export const BookmarkServiceLive = Layer.effect(
  BookmarkService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;
    return createBookmarkMethods(db);
  }),
);
