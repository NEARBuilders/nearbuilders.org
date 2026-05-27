import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const builders = pgTable(
  "builders",
  {
    id: text("id").primaryKey(),
    nearAccount: text("near_account").notNull().unique(),
    userId: text("user_id"),
    name: text("name"),
    bio: text("bio"),
    skills: text("skills"),
    location: text("location"),
    links: text("links"),
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("builders_near_account_idx").on(table.nearAccount),
    index("builders_status_idx").on(table.status),
    index("builders_user_id_idx").on(table.userId),
  ],
);
