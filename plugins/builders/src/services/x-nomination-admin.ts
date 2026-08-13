import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { ORPCError } from "every-plugin/orpc";
import type { Database } from "../db";
import { builderNominations, builders, builderXIdentities } from "../db/schema";
import { buildJoinUrl, createNominationToken, hasMatchingTokenHash } from "./nominations";

type NominationRow = typeof builderNominations.$inferSelect;
type XIdentityRow = typeof builderXIdentities.$inferSelect;

function toIsoString(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

function toNullableIsoString(value: Date | string | null | undefined): string | null {
  return value ? toIsoString(value) : null;
}

export const XNominationEngagementStatus = [
  "pending_contact",
  "contacted",
  "rejected",
  "completed",
] as const;

export type XNominationEngagementStatusValue = (typeof XNominationEngagementStatus)[number];
export type XNominationAdminAction = "mark_contacted" | "reject" | "reopen";

export interface XNominationQueueRecord {
  id: string;
  canonicalNominationId: string;
  isCanonical: boolean;
  sourcePostId: string;
  sourcePostUrl: string;
  sourcePostText: string;
  sourcePostCreatedAt: string | null;
  conversationId: string | null;
  replyToPostId: string | null;
  nominatorXId: string;
  nominatorXUsername: string;
  nomineeXId: string;
  nomineeXUsername: string;
  linkedNomineeBuilderId: string | null;
  linkedNomineeNearAccount: string | null;
  linkedNominatorBuilderId: string | null;
  linkedNominatorNearAccount: string | null;
  canonicalSourcePostId: string;
  sourceReferralCount: number;
  joinUrl: string | null;
  engagementStatus: XNominationEngagementStatusValue;
  replyUrl: string | null;
  contactedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
  engagementUpdatedAt: string;
  updatedBy: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  openCount: number;
  proposalId: string | null;
  submittedNearAccount: string | null;
  submittedAt: string | null;
  profileStatus: "not_started" | "submitted";
  createdAt: string;
}

export interface XNominationMetrics {
  totalNominations: number;
  uniqueNominees: number;
  pendingReviewCount: number;
  humanReviewedContacts: number;
  qualifiedEngagementReplies: number;
  secureLinkOpens: number;
  profilesSubmitted: number;
  registrationConversionRate: number;
  byNominator: Array<{
    xId: string;
    username: string;
    nominations: number;
    qualifiedReplies: number;
    profilesSubmitted: number;
  }>;
  bySourcePost: Array<{
    postId: string;
    postUrl: string;
    opens: number;
    profileSubmitted: boolean;
  }>;
}

interface QueueContext {
  canonicalById: Map<string, NominationRow>;
  referralCounts: Map<string, number>;
  identitiesByXId: Map<string, XIdentityRow>;
  nearAccountByBuilderId: Map<string, string>;
  joinBaseUrl: string;
  tokenSecret: string;
}

function toQueueRecord(row: NominationRow, context: QueueContext): XNominationQueueRecord {
  const canonicalId = row.canonicalNominationId ?? row.id;
  const canonical = context.canonicalById.get(canonicalId) ?? row;
  const nomineeXId = row.sourceNomineeXId ?? canonical.nomineeXId ?? "";
  const nominatorXId = row.nominatorXId ?? "";
  const nomineeIdentity = context.identitiesByXId.get(nomineeXId);
  const nominatorIdentity = context.identitiesByXId.get(nominatorXId);
  let joinUrl: string | null = null;
  if (row.tokenHash && !canonical.submittedAt && !nomineeIdentity?.builderId) {
    const token = createNominationToken(context.tokenSecret, row.id);
    if (!hasMatchingTokenHash(token, row.tokenHash)) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Nomination token secret does not match the stored invitation",
      });
    }
    joinUrl = buildJoinUrl(context.joinBaseUrl, token);
  }
  return {
    id: row.id,
    canonicalNominationId: canonicalId,
    isCanonical: row.id === canonicalId,
    sourcePostId: row.sourceNominationId,
    sourcePostUrl: row.sourcePostUrl ?? "",
    sourcePostText: row.sourcePostText ?? "",
    sourcePostCreatedAt: toNullableIsoString(row.sourcePostCreatedAt),
    conversationId: row.conversationId,
    replyToPostId: row.replyToPostId,
    nominatorXId,
    nominatorXUsername: row.nominatorXUsername ?? "",
    nomineeXId,
    nomineeXUsername: row.sourceNomineeXUsername ?? canonical.nomineeXUsername ?? "",
    linkedNomineeBuilderId: nomineeIdentity?.builderId ?? null,
    linkedNomineeNearAccount: nomineeIdentity?.builderId
      ? (context.nearAccountByBuilderId.get(nomineeIdentity.builderId) ?? null)
      : null,
    linkedNominatorBuilderId: nominatorIdentity?.builderId ?? null,
    linkedNominatorNearAccount: nominatorIdentity?.builderId
      ? (context.nearAccountByBuilderId.get(nominatorIdentity.builderId) ?? null)
      : null,
    canonicalSourcePostId: canonical.sourceNominationId,
    sourceReferralCount: context.referralCounts.get(canonicalId) ?? 1,
    joinUrl,
    engagementStatus: row.engagementStatus as XNominationEngagementStatusValue,
    replyUrl: row.replyUrl,
    contactedAt: toNullableIsoString(row.contactedAt),
    rejectedAt: toNullableIsoString(row.rejectedAt),
    completedAt: toNullableIsoString(row.completedAt),
    engagementUpdatedAt: toIsoString(row.engagementUpdatedAt),
    updatedBy: row.updatedBy,
    firstOpenedAt: toNullableIsoString(row.firstOpenedAt),
    lastOpenedAt: toNullableIsoString(row.lastOpenedAt),
    openCount: row.openCount,
    proposalId: canonical.proposalId,
    submittedNearAccount: canonical.submittedNearAccount,
    submittedAt: toNullableIsoString(canonical.submittedAt),
    profileStatus: canonical.submittedAt || canonical.proposalId ? "submitted" : "not_started",
    createdAt: toIsoString(row.createdAt),
  };
}

async function hydrateXQueueRows(
  db: Database,
  rows: NominationRow[],
  joinBaseUrl: string,
  tokenSecret: string,
) {
  if (rows.length === 0) return [];
  const canonicalIds = [...new Set(rows.map((row) => row.canonicalNominationId ?? row.id))];
  const canonicalRows = await db
    .select()
    .from(builderNominations)
    .where(inArray(builderNominations.id, canonicalIds));
  const canonicalKey = sql<string>`coalesce(${builderNominations.canonicalNominationId}, ${builderNominations.id})`;
  const referralCountRows = await db
    .select({ canonicalId: canonicalKey, count: count() })
    .from(builderNominations)
    .where(eq(builderNominations.source, "x"))
    .groupBy(canonicalKey);
  const referralCounts = new Map(referralCountRows.map((row) => [row.canonicalId, row.count]));
  const xIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.sourceNomineeXId, row.nomineeXId, row.nominatorXId])
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const identities = xIds.length
    ? await db.select().from(builderXIdentities).where(inArray(builderXIdentities.xUserId, xIds))
    : [];
  const builderIds = [
    ...new Set(
      identities
        .map((identity) => identity.builderId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const builderRows = builderIds.length
    ? await db
        .select({ id: builders.id, nearAccount: builders.nearAccount })
        .from(builders)
        .where(inArray(builders.id, builderIds))
    : [];
  const context: QueueContext = {
    canonicalById: new Map(canonicalRows.map((row) => [row.id, row])),
    referralCounts,
    identitiesByXId: new Map(identities.map((identity) => [identity.xUserId!, identity])),
    nearAccountByBuilderId: new Map(
      builderRows.map((builder) => [builder.id, builder.nearAccount]),
    ),
    joinBaseUrl,
    tokenSecret,
  };
  return rows.map((row) => toQueueRecord(row, context));
}

export async function listXNominationQueue(
  db: Database,
  input: {
    status?: XNominationEngagementStatusValue;
    search?: string;
    limit?: number;
    cursor?: string;
    joinBaseUrl: string;
    tokenSecret: string;
  },
) {
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
  const conditions = [eq(builderNominations.source, "x")];
  if (input.status) conditions.push(eq(builderNominations.engagementStatus, input.status));
  if (input.search?.trim()) {
    const pattern = `%${input.search.trim()}%`;
    const search = or(
      ilike(builderNominations.sourceNomineeXUsername, pattern),
      ilike(builderNominations.nominatorXUsername, pattern),
      ilike(builderNominations.sourcePostText, pattern),
    );
    if (search) conditions.push(search);
  }
  const where = and(...conditions);
  const [[totalRow], rows] = await Promise.all([
    db.select({ count: count() }).from(builderNominations).where(where),
    db
      .select()
      .from(builderNominations)
      .where(where)
      .orderBy(desc(builderNominations.engagementUpdatedAt), desc(builderNominations.createdAt))
      .limit(limit)
      .offset(offset),
  ]);
  const data = await hydrateXQueueRows(db, rows, input.joinBaseUrl, input.tokenSecret);
  const total = totalRow?.count ?? 0;
  const nextOffset = offset + limit;
  return {
    data,
    meta: {
      total,
      hasMore: nextOffset < total,
      nextCursor: nextOffset < total ? String(nextOffset) : null,
    },
  };
}

export async function updateXNomination(
  db: Database,
  input: {
    nominationId: string;
    expectedEngagementUpdatedAt: string;
    action: XNominationAdminAction;
    replyUrl?: string;
    actorUserId: string;
    joinBaseUrl: string;
    tokenSecret: string;
  },
) {
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(builderNominations)
      .where(eq(builderNominations.id, input.nominationId))
      .for("update")
      .limit(1);
    if (!row || row.source !== "x") {
      throw new ORPCError("NOT_FOUND", { message: "X nomination not found" });
    }
    if (toIsoString(row.engagementUpdatedAt) !== input.expectedEngagementUpdatedAt) {
      throw new ORPCError("NOMINATION_CONFLICT", {
        message: "X nomination changed before this action was applied",
      });
    }
    const now = new Date();
    const updates: Partial<typeof builderNominations.$inferInsert> = {
      engagementUpdatedAt: now,
      updatedBy: input.actorUserId,
    };
    if (input.action === "mark_contacted") {
      updates.engagementStatus = "contacted";
      if (input.replyUrl) updates.replyUrl = input.replyUrl.trim();
      updates.contactedAt = row.contactedAt ?? now;
    } else if (input.action === "reject") {
      updates.engagementStatus = "rejected";
      updates.rejectedAt = now;
    } else {
      updates.engagementStatus = "pending_contact";
      updates.rejectedAt = null;
    }
    const [next] = await tx
      .update(builderNominations)
      .set(updates)
      .where(
        and(
          eq(builderNominations.id, row.id),
          eq(builderNominations.engagementUpdatedAt, row.engagementUpdatedAt),
        ),
      )
      .returning();
    if (!next) {
      throw new ORPCError("NOMINATION_CONFLICT", {
        message: "X nomination changed before this action was applied",
      });
    }
    return next;
  });
  const [record] = await hydrateXQueueRows(db, [updated], input.joinBaseUrl, input.tokenSecret);
  if (!record) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Updated X nomination could not be loaded",
    });
  }
  return record;
}

export async function getXNominationMetrics(db: Database): Promise<XNominationMetrics> {
  const rows = await db.select().from(builderNominations).where(eq(builderNominations.source, "x"));
  const canonicalById = new Map(
    rows.filter((row) => !row.canonicalNominationId).map((row) => [row.id, row]),
  );
  const contactedCanonicalIds = new Set<string>();
  const byNominator = new Map<string, XNominationMetrics["byNominator"][number]>();
  const bySourcePost: XNominationMetrics["bySourcePost"] = [];
  for (const row of rows) {
    const canonicalId = row.canonicalNominationId ?? row.id;
    const canonical = canonicalById.get(canonicalId) ?? row;
    const qualified = Boolean(row.contactedAt && row.replyUrl);
    if (qualified && canonical.tokenHash) contactedCanonicalIds.add(canonicalId);
    const nominatorId = row.nominatorXId ?? "unknown";
    const attribution = byNominator.get(nominatorId) ?? {
      xId: nominatorId,
      username: row.nominatorXUsername ?? "",
      nominations: 0,
      qualifiedReplies: 0,
      profilesSubmitted: 0,
    };
    attribution.nominations += 1;
    if (qualified) attribution.qualifiedReplies += 1;
    if (canonical.submittedAt) attribution.profilesSubmitted += 1;
    byNominator.set(nominatorId, attribution);
    bySourcePost.push({
      postId: row.sourceNominationId,
      postUrl: row.sourcePostUrl ?? "",
      opens: row.openCount,
      profileSubmitted: Boolean(canonical.submittedAt),
    });
  }
  const submittedContacted = [...contactedCanonicalIds].filter(
    (id) => canonicalById.get(id)?.submittedAt,
  ).length;
  const uniqueNominees = new Set(
    rows.map((row) => row.sourceNomineeXId ?? row.nomineeXId).filter(Boolean),
  ).size;
  const eligibleContacted = [...contactedCanonicalIds];
  return {
    totalNominations: rows.length,
    uniqueNominees,
    pendingReviewCount: rows.filter((row) => row.engagementStatus === "pending_contact").length,
    humanReviewedContacts: rows.filter((row) => row.contactedAt).length,
    qualifiedEngagementReplies: rows.filter((row) => row.contactedAt && row.replyUrl).length,
    secureLinkOpens: rows.reduce((total, row) => total + row.openCount, 0),
    profilesSubmitted: [...canonicalById.values()].filter((row) => row.submittedAt).length,
    registrationConversionRate: eligibleContacted.length
      ? submittedContacted / eligibleContacted.length
      : 0,
    byNominator: [...byNominator.values()].sort(
      (left, right) => right.nominations - left.nominations,
    ),
    bySourcePost: bySourcePost.sort((left, right) => right.opens - left.opens),
  };
}
