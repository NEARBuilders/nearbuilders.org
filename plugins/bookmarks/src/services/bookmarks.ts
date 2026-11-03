import { and, eq, inArray, isNull } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DatabaseTag } from "../db/layer";
import { bookmarks } from "../db/schema";
import { createClaimTracker, isUniqueViolation, type Owner, ownedBy } from "../lib/owner";

function generateId(): string {
  return `bm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function createBookmarkMethods(db: any) {
  const bookmarked = (owner: Owner) => ownedBy(bookmarks, owner);
  const claims = createClaimTracker();

  /**
   * Moves the caller's legacy bookmarks (user id only) onto their primary account, dropping
   * any that duplicate one of their accounts' bookmarks. This is the backfill for #329: it
   * runs as each user comes back, since the auth DB is never read directly.
   */
  const claimLegacyBookmarks = async (owner: Owner) => {
    const primary = owner.accounts[0];
    if (!primary || !owner.userId) return;
    const legacy = and(eq(bookmarks.userId, owner.userId), isNull(bookmarks.nearAccount));
    const alreadyBookmarked = db
      .select({ entityId: bookmarks.entityId })
      .from(bookmarks)
      .where(inArray(bookmarks.nearAccount, owner.accounts));
    await db.delete(bookmarks).where(and(legacy, inArray(bookmarks.entityId, alreadyBookmarked)));
    await db.update(bookmarks).set({ nearAccount: primary }).where(legacy);
    claims.add(owner);
  };

  /** Read endpoints claim once per user per process; until then they match legacy rows by user id. */
  const claimLegacyBookmarksOnce = async (owner: Owner) => {
    if (!claims.has(owner)) await claimLegacyBookmarks(owner);
  };

  const findBookmark = async (entityId: string, owner: Owner) => {
    const [row] = await db
      .select({ id: bookmarks.id })
      .from(bookmarks)
      .where(and(eq(bookmarks.entityId, entityId), bookmarked(owner)))
      .limit(1);
    return row ?? null;
  };

  return {
    async bookmark(entityId: string, owner: Owner) {
      await claimLegacyBookmarks(owner);
      if (!(await findBookmark(entityId, owner))) {
        try {
          await db.insert(bookmarks).values({
            id: generateId(),
            entityId,
            nearAccount: owner.accounts[0] ?? null,
            userId: owner.userId,
          });
        } catch (error) {
          // A concurrent bookmark from the same user won the unique index; anything else is real.
          if (!isUniqueViolation(error)) throw error;
        }
      }

      return { entityId, userId: owner.userId };
    },

    async unbookmark(entityId: string, owner: Owner) {
      await claimLegacyBookmarks(owner);
      await db.delete(bookmarks).where(and(eq(bookmarks.entityId, entityId), bookmarked(owner)));

      return { entityId };
    },

    async getUserBookmark(entityId: string, owner: Owner) {
      await claimLegacyBookmarksOnce(owner);
      return { entityId, isBookmarked: Boolean(await findBookmark(entityId, owner)) };
    },
  };
}

type BookmarkMethods = ReturnType<typeof createBookmarkMethods>;

export class BookmarkService extends Context.Service<BookmarkService, BookmarkMethods>()(
  "bookmarks/BookmarkService",
) {}

export const BookmarkServiceLive = Layer.effect(
  BookmarkService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;
    return createBookmarkMethods(db);
  }),
);
