import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    /**
     * The recipient's owner id (primary NEAR account, or auth user id without NEAR), despite
     * the name (#367). Reads match it against all of the caller's ids.
     */
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    source: text("source").notNull(),
    subject: text("subject").notNull(),
    body: text("body"),
    link: text("link").notNull(),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_user_read_idx").on(table.userId, table.read),
    index("notifications_user_created_at_idx").on(table.userId, table.createdAt),
  ],
);
