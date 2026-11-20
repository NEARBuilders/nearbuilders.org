import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const nearcatalogClaims = pgTable(
  "nearcatalog_claims",
  {
    id: text("id").primaryKey(),
    nearAccount: text("near_account").notNull(),
    projectSlug: text("project_slug").notNull(),
    roles: jsonb("roles").$type<string[]>().notNull(),
    activityEventId: text("activity_event_id"),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("nearcatalog_claims_builder_project_unique").on(
      table.nearAccount,
      table.projectSlug,
    ),
    index("nearcatalog_claims_near_account_idx").on(table.nearAccount),
    index("nearcatalog_claims_project_slug_idx").on(table.projectSlug),
    index("nearcatalog_claims_revoked_at_idx").on(table.revokedAt),
  ],
);

export const nearcatalogClaimHistory = pgTable(
  "nearcatalog_claim_history",
  {
    id: text("id").primaryKey(),
    claimId: text("claim_id").notNull(),
    nearAccount: text("near_account").notNull(),
    projectSlug: text("project_slug").notNull(),
    roles: jsonb("roles").$type<string[]>().notNull(),
    activityEventId: text("activity_event_id"),
    action: text("action").$type<"applied" | "activity-linked" | "revoked">().notNull(),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("nearcatalog_claim_history_claim_id_idx").on(table.claimId),
    index("nearcatalog_claim_history_project_slug_idx").on(table.projectSlug),
  ],
);

export const nearcatalogListings = pgTable(
  "nearcatalog_listings",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<"project" | "person">().notNull(),
    entityId: text("entity_id").notNull(),
    ownerId: text("owner_id").notNull(),
    slug: text("slug").notNull(),
    status: text("status")
      .$type<"none" | "pending" | "approved" | "rejected" | "published">()
      .notNull(),
    record: jsonb("record").$type<Record<string, unknown>>(),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { mode: "date", withTimezone: true }),
    publishedAt: timestamp("published_at", { mode: "date", withTimezone: true }),
    removedAt: timestamp("removed_at", { mode: "date", withTimezone: true }),
    catalogUrl: text("catalog_url"),
    sendStatus: text("send_status").$type<"sent" | "failed">(),
    sendAction: text("send_action").$type<"upsert" | "remove">(),
    sendError: text("send_error"),
    sendAttemptedAt: timestamp("send_attempted_at", { mode: "date", withTimezone: true }),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    changedAt: timestamp("changed_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("nearcatalog_listings_kind_entity_unique").on(table.kind, table.entityId),
    index("nearcatalog_listings_kind_slug_idx").on(table.kind, table.slug),
    index("nearcatalog_listings_status_idx").on(table.status),
    index("nearcatalog_listings_changed_at_idx").on(table.changedAt),
    index("nearcatalog_listings_send_status_idx").on(table.sendStatus),
  ],
);
