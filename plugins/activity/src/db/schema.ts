import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const activityEvents = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    type: text("type").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    verified: boolean("verified").default(false).notNull(),
    idempotencyKey: text("idempotency_key"),
    hiddenAt: timestamp("hidden_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_events_source_idx").on(table.source),
    index("activity_events_type_idx").on(table.type),
    index("activity_events_actor_idx").on(table.actor),
    index("activity_events_created_at_idx").on(table.createdAt),
    index("activity_events_hidden_at_idx").on(table.hiddenAt),
    uniqueIndex("activity_events_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

export const activitySettings = pgTable("activity_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const activityGatewayOutbox = pgTable(
  "activity_gateway_outbox",
  {
    id: text("id").primaryKey(),
    operation: text("operation").notNull(),
    legacyEventId: text("legacy_event_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    legacySource: text("legacy_source").notNull(),
    legacyType: text("legacy_type").notNull(),
    eventType: text("event_type").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload").$type<unknown>(),
    reason: text("reason"),
    status: text("status").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    gatewayEventId: text("gateway_event_id"),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("activity_gateway_outbox_operation_key_unique").on(
      table.operation,
      table.idempotencyKey,
    ),
    index("activity_gateway_outbox_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
    index("activity_gateway_outbox_legacy_event_idx").on(table.legacyEventId),
  ],
);
