import { bigint, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("builders_near_account_idx").on(table.nearAccount),
    index("builders_user_id_idx").on(table.userId),
  ],
);

export const builderNominations = pgTable(
  "builder_nominations",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceNominationId: text("source_nomination_id").notNull(),
    sourceNomineeTelegramId: bigint("source_nominee_telegram_id", { mode: "number" }),
    sourceNomineeUsernameNormalized: text("source_nominee_username_normalized"),
    nomineeTelegramId: bigint("nominee_telegram_id", { mode: "number" }),
    nomineeUsername: text("nominee_username"),
    unresolvedUsernameNormalized: text("unresolved_username_normalized"),
    nominatedByTelegramId: bigint("nominated_by_telegram_id", { mode: "number" }).notNull(),
    telegramGroupId: bigint("telegram_group_id", { mode: "number" }).notNull(),
    createdByApiKeyId: text("created_by_api_key_id").notNull(),
    tokenHash: text("token_hash"),
    canonicalNominationId: text("canonical_nomination_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    proposalId: text("proposal_id"),
    submittedNearAccount: text("submitted_near_account"),
    submittedUserId: text("submitted_user_id"),
    submittedAt: timestamp("submitted_at"),
  },
  (table) => [
    uniqueIndex("builder_nominations_source_unique").on(table.source, table.sourceNominationId),
    uniqueIndex("builder_nominations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("builder_nominations_telegram_id_unique").on(table.nomineeTelegramId),
    uniqueIndex("builder_nominations_unresolved_username_unique").on(
      table.unresolvedUsernameNormalized,
    ),
  ],
);
