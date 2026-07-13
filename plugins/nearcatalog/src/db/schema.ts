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
