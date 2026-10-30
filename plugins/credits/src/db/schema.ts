import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const creditClaimStatuses = ["pending", "issued", "failed", "revoked"] as const;

export const creditClaims = pgTable(
  "credit_claims",
  {
    id: text("id").primaryKey(),
    nearAccountId: text("near_account_id").notNull(),
    userId: text("user_id").notNull(),
    status: text("status", { enum: creditClaimStatuses }).notNull(),
    attempt: integer("attempt").default(1).notNull(),
    spendLimitCents: integer("spend_limit_cents").notNull(),
    keyExpiresAt: timestamp("key_expires_at", { mode: "date", withTimezone: true }).notNull(),
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
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});
