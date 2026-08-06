import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const issueClaims = pgTable(
  "issue_claims",
  {
    id: text("id").primaryKey(),
    repoOwner: text("repo_owner").notNull(),
    repoName: text("repo_name").notNull(),
    issueNumber: integer("issue_number").notNull(),
    issueTitle: text("issue_title").notNull(),
    issueUrl: text("issue_url").notNull(),
    nearAccount: text("near_account").notNull(),
    claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    releasedAt: timestamp("released_at", { mode: "date", withTimezone: true }),
    prUrl: text("pr_url"),
    prState: text("pr_state").$type<"open" | "merged" | "closed" | null>(),
    prCheckedAt: timestamp("pr_checked_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("issue_claims_repo_issue_active_unique").on(
      table.repoOwner,
      table.repoName,
      table.issueNumber,
      table.releasedAt,
    ),
    index("issue_claims_near_account_idx").on(table.nearAccount),
    index("issue_claims_expires_at_idx").on(table.expiresAt),
    index("issue_claims_released_at_idx").on(table.releasedAt),
  ],
);
