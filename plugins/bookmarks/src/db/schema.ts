import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id").notNull(),
    /** The owner's primary NEAR account when they bookmarked (#329). Null on legacy rows not yet claimed. */
    nearAccount: text("near_account"),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bookmarks_entity_user_unique").on(table.entityId, table.userId),
    uniqueIndex("bookmarks_entity_near_account_unique").on(table.entityId, table.nearAccount),
    index("bookmarks_near_account_idx").on(table.nearAccount),
    index("bookmarks_user_id_idx").on(table.userId),
  ],
);
