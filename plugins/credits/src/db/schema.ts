import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const creditClaimStatuses = [
  "pending",
  "issued",
  "failed",
  "revoked",
  "replaceable",
] as const;

export const creditClaims = pgTable(
  "credit_claims",
  {
    id: text("id").primaryKey(),
    nearAccountId: text("near_account_id").notNull(),
    userId: text("user_id").notNull(),
    status: text("status", { enum: creditClaimStatuses }).notNull(),
    attempt: integer("attempt").default(1).notNull(),
    spendLimitCents: integer("spend_limit_cents").notNull(),
    keyExpiresAt: timestamp("key_expires_at", { mode: "date", withTimezone: true }),
    keyId: text("key_id"),
    keyPrefix: text("key_prefix"),
    ip: text("ip"),
    error: text("error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("credit_claims_near_account_unique").on(table.nearAccountId),
    uniqueIndex("credit_claims_user_unique").on(table.userId),
  ],
);

export const nearAiSessions = pgTable("nearai_sessions", {
  id: text("id").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at", { mode: "date", withTimezone: true }),
  orgId: text("org_id"),
  reportingToken: text("reporting_token"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const creditSettings = pgTable("credits_settings", {
  id: text("id").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).default("5.00").notNull(),
  claimsCloseAt: timestamp("claims_close_at", { mode: "date", withTimezone: true }),
  keyExpiresAt: timestamp("key_expires_at", { mode: "date", withTimezone: true }),
  nearAiWorkspaceId: text("near_ai_workspace_id").default("").notNull(),
  nearAiLoginAccountId: text("near_ai_login_account_id").default("").notNull(),
  nearAiOrgId: text("near_ai_org_id").default("").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});
