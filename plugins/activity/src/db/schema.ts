import { boolean, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    type: text("type").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    verified: boolean("verified").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_events_source_idx").on(table.source),
    index("activity_events_type_idx").on(table.type),
    index("activity_events_actor_idx").on(table.actor),
    index("activity_events_created_at_idx").on(table.createdAt),
  ],
);
