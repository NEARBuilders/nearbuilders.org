import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const emailPreferences = pgTable("email_preferences", {
  userId: text("user_id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  email: text("email"),
  verifiedAt: timestamp("verified_at", { mode: "date", withTimezone: true }),
  pendingEmail: text("pending_email"),
  codeHash: text("code_hash"),
  codeExpiresAt: timestamp("code_expires_at", { mode: "date", withTimezone: true }),
});

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
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
