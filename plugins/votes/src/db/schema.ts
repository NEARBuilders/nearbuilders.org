import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const upvotes = pgTable(
  "upvotes",
  {
    id: text("id").primaryKey(),
    entityId: text("thing_id").notNull(),
    /** The voter's primary NEAR account when they voted (#329). Null on legacy rows not yet claimed. */
    nearAccount: text("near_account"),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("upvotes_thing_user_unique").on(table.entityId, table.userId),
    uniqueIndex("upvotes_thing_near_account_unique").on(table.entityId, table.nearAccount),
    index("upvotes_near_account_idx").on(table.nearAccount),
    index("upvotes_user_id_idx").on(table.userId),
  ],
);
