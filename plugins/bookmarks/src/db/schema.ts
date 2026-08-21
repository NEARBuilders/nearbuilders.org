import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("bookmarks_entity_user_unique").on(table.entityId, table.userId)],
);
