import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { ORPCError } from "every-plugin/orpc";
import type { Database } from "../db";
import { builderNominations, builders, builderXIdentities } from "../db/schema";

type NominationRow = typeof builderNominations.$inferSelect;
type XIdentityRow = typeof builderXIdentities.$inferSelect;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

export interface XNominationInput {
  source: "x";
  sourceNominationId: string;
  sourcePostUrl: string;
  sourcePostText: string;
  sourcePostCreatedAt: string | null;
  nominatedByXId: string;
  nominatedByXUsername: string;
  nomineeXId: string;
  nomineeXUsername: string;
  conversationId: string | null;
  replyToPostId: string | null;
}

export interface XReferralContext {
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
}

export interface NominationMetadata {
  nominationId: string;
  referralNominationId: string;
  source: "telegram" | "x";
  referralContext?: XReferralContext;
}

export interface ResolvedNominationRecord {
  canonical: NominationRow;
  referral: NominationRow;
}

export function hashNominationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createNominationToken(tokenSecret: string, nominationId: string): string {
  return createHmac("sha256", tokenSecret)
    .update(`telegram-nomination:v1:${nominationId}`, "utf8")
    .digest("base64url");
}

export function buildJoinUrl(joinBaseUrl: string, token: string): string {
  const url = new URL("/join", joinBaseUrl);
  if (url.protocol !== "https:") {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Nomination join URL must use HTTPS",
    });
  }
  url.searchParams.set("nomination", token);
  return url.toString();
}

export function hasMatchingTokenHash(token: string, storedHash: string): boolean {
  const expected = Buffer.from(hashNominationToken(token), "hex");
  const actual = Buffer.from(storedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function randomNominationId(): string {
  return `nom_${randomBytes(16).toString("base64url")}`;
}

function toIsoString(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

function toNullableIsoString(value: Date | string | null | undefined): string | null {
  return value ? toIsoString(value) : null;
}

function normalizeXUsername(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

function displayXUsername(username: string): string {
  return username.trim().replace(/^@/, "");
}

function assertDecimalId(value: string, field: string) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ORPCError("BAD_REQUEST", { message: `${field} must be a decimal X ID` });
  }
}

function assertXNomination(input: XNominationInput) {
  assertDecimalId(input.sourceNominationId, "sourceNominationId");
  assertDecimalId(input.nominatedByXId, "nominatedByXId");
  assertDecimalId(input.nomineeXId, "nomineeXId");
  if (input.conversationId) assertDecimalId(input.conversationId, "conversationId");
  if (input.replyToPostId) assertDecimalId(input.replyToPostId, "replyToPostId");
  if (input.nominatedByXId === input.nomineeXId) {
    throw new ORPCError("BAD_REQUEST", { message: "X users cannot nominate themselves" });
  }
  if (!input.sourcePostText.trim()) {
    throw new ORPCError("BAD_REQUEST", { message: "sourcePostText cannot be blank" });
  }
  const usernames = [input.nominatedByXUsername, input.nomineeXUsername];
  if (usernames.some((username) => !/^[A-Za-z0-9_]{1,15}$/.test(displayXUsername(username)))) {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid X username" });
  }
  let postUrl: URL;
  try {
    postUrl = new URL(input.sourcePostUrl);
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid X post URL" });
  }
  const path = postUrl.pathname.split("/").filter(Boolean);
  const statusIndex = path.lastIndexOf("status");
  if (
    postUrl.protocol !== "https:" ||
    !["x.com", "www.x.com"].includes(postUrl.hostname.toLowerCase()) ||
    statusIndex < 0 ||
    path[statusIndex + 1] !== input.sourceNominationId
  ) {
    throw new ORPCError("BAD_REQUEST", {
      message: "sourcePostUrl must identify sourceNominationId on x.com",
    });
  }
  if (input.sourcePostCreatedAt && Number.isNaN(Date.parse(input.sourcePostCreatedAt))) {
    throw new ORPCError("BAD_REQUEST", { message: "Invalid sourcePostCreatedAt" });
  }
}

function sameInstant(left: Date | null, right: string | null): boolean {
  if (!left || !right) return left === null && right === null;
  return left.getTime() === new Date(right).getTime();
}

function assertMatchingXNomination(existing: NominationRow, input: XNominationInput) {
  const matches =
    existing.source === "x" &&
    existing.sourceNominationId === input.sourceNominationId &&
    existing.sourcePostUrl === input.sourcePostUrl &&
    existing.sourcePostText === input.sourcePostText &&
    sameInstant(existing.sourcePostCreatedAt, input.sourcePostCreatedAt) &&
    existing.nominatorXId === input.nominatedByXId &&
    normalizeXUsername(existing.nominatorXUsername ?? "") ===
      normalizeXUsername(input.nominatedByXUsername) &&
    existing.sourceNomineeXId === input.nomineeXId &&
    normalizeXUsername(existing.sourceNomineeXUsername ?? "") ===
      normalizeXUsername(input.nomineeXUsername) &&
    existing.conversationId === input.conversationId &&
    existing.replyToPostId === input.replyToPostId;
  if (!matches) {
    throw new ORPCError("IDEMPOTENCY_CONFLICT", {
      message: "The nomination identifier was already used with different data",
    });
  }
}

export async function resolveCanonicalNomination(
  executor: Executor,
  initial: NominationRow,
  lock = false,
): Promise<NominationRow> {
  let current = initial;
  const visited = new Set<string>();
  while (current.canonicalNominationId) {
    if (visited.has(current.id)) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Nomination referrals contain a cycle",
      });
    }
    visited.add(current.id);
    const query = executor
      .select()
      .from(builderNominations)
      .where(eq(builderNominations.id, current.canonicalNominationId))
      .limit(1);
    const [canonical] = lock ? await query.for("update") : await query;
    if (!canonical) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Nomination referral has no canonical nomination",
      });
    }
    current = canonical;
  }
  return current;
}

function xReferralContext(row: NominationRow): XReferralContext | undefined {
  if (row.source !== "x") return undefined;
  return {
    sourcePostId: row.sourceNominationId,
    sourcePostUrl: row.sourcePostUrl ?? "",
    sourcePostText: row.sourcePostText ?? "",
    sourcePostCreatedAt: toNullableIsoString(row.sourcePostCreatedAt),
    conversationId: row.conversationId,
    replyToPostId: row.replyToPostId,
    nominatorXId: row.nominatorXId ?? "",
    nominatorXUsername: row.nominatorXUsername ?? "",
    nomineeXId: row.sourceNomineeXId ?? row.nomineeXId ?? "",
    nomineeXUsername: row.sourceNomineeXUsername ?? row.nomineeXUsername ?? "",
  };
}

export function nominationMetadata(
  canonical: NominationRow,
  referral: NominationRow = canonical,
): NominationMetadata {
  const metadata: NominationMetadata = {
    nominationId: canonical.id,
    referralNominationId: referral.id,
    source: canonical.source === "x" ? "x" : "telegram",
  };
  const referralContext = xReferralContext(referral);
  if (referralContext) metadata.referralContext = referralContext;
  return metadata;
}

async function findIdentityByXId(executor: Executor, xUserId: string) {
  const [identity] = await executor
    .select()
    .from(builderXIdentities)
    .where(eq(builderXIdentities.xUserId, xUserId))
    .limit(1);
  return identity ?? null;
}

async function upsertXIdentity(
  executor: Executor,
  input: { xUserId: string; username: string },
): Promise<XIdentityRow> {
  const username = displayXUsername(input.username);
  const usernameNormalized = normalizeXUsername(username);
  const byId = await findIdentityByXId(executor, input.xUserId);
  if (byId) {
    const candidates = byId.builderId
      ? []
      : await executor
          .select()
          .from(builderXIdentities)
          .where(eq(builderXIdentities.usernameNormalized, usernameNormalized));
    const builderIds = [...new Set(candidates.map((row) => row.builderId).filter(Boolean))];
    const [updated] = await executor
      .update(builderXIdentities)
      .set({
        username,
        usernameNormalized,
        builderId: byId.builderId ?? (builderIds.length === 1 ? builderIds[0] : null),
        updatedAt: new Date(),
      })
      .where(eq(builderXIdentities.id, byId.id))
      .returning();
    return updated ?? byId;
  }

  const candidates = await executor
    .select()
    .from(builderXIdentities)
    .where(eq(builderXIdentities.usernameNormalized, usernameNormalized));
  const candidate = candidates.length === 1 ? candidates[0] : undefined;
  if (candidate && !candidate.xUserId) {
    const [claimed] = await executor
      .update(builderXIdentities)
      .set({ xUserId: input.xUserId, username, updatedAt: new Date() })
      .where(
        and(eq(builderXIdentities.id, candidate.id), sql`${builderXIdentities.xUserId} is null`),
      )
      .returning();
    if (claimed) return claimed;
  }

  const id = `xid_${randomBytes(16).toString("base64url")}`;
  const [inserted] = await executor
    .insert(builderXIdentities)
    .values({
      id,
      xUserId: input.xUserId,
      username,
      usernameNormalized,
      builderId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) return inserted;
  const concurrent = await findIdentityByXId(executor, input.xUserId);
  if (!concurrent) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not save X identity" });
  }
  const [updated] = await executor
    .update(builderXIdentities)
    .set({ username, usernameNormalized, updatedAt: new Date() })
    .where(eq(builderXIdentities.id, concurrent.id))
    .returning();
  return updated ?? concurrent;
}

function extractXUsername(links: Record<string, string> | null): string | null {
  const raw = links?.twitter ?? links?.x;
  if (!raw?.trim()) return null;
  const value = raw.trim().replace(/^@/, "");
  try {
    const url = new URL(value.includes("://") ? value : `https://x.com/${value}`);
    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname)) {
      return null;
    }
    const username = url.pathname.split("/").filter(Boolean)[0];
    return username && /^[A-Za-z0-9_]{1,15}$/.test(username) ? username : null;
  } catch {
    return /^[A-Za-z0-9_]{1,15}$/.test(value) ? value : null;
  }
}

export async function syncBuilderXIdentity(
  db: Database,
  builderId: string,
  links: Record<string, string> | null,
) {
  const username = extractXUsername(links);
  if (!username) return;
  const usernameNormalized = normalizeXUsername(username);
  const matches = await db
    .select()
    .from(builderXIdentities)
    .where(eq(builderXIdentities.usernameNormalized, usernameNormalized));
  const match = matches.length === 1 ? matches[0] : undefined;
  if (match) {
    if (match.builderId && match.builderId !== builderId) return;
    await db
      .update(builderXIdentities)
      .set({ builderId, username, updatedAt: new Date() })
      .where(eq(builderXIdentities.id, match.id));
    return;
  }
  if (matches.length > 1) return;
  await db.insert(builderXIdentities).values({
    id: `xid_${randomBytes(16).toString("base64url")}`,
    xUserId: null,
    username,
    usernameNormalized,
    builderId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function syncSubmittedXIdentity(db: Database, builderId: string, nearAccount: string) {
  const [nomination] = await db
    .select({ nomineeXId: builderNominations.nomineeXId })
    .from(builderNominations)
    .where(
      and(
        eq(builderNominations.source, "x"),
        eq(builderNominations.submittedNearAccount, nearAccount),
        sql`${builderNominations.canonicalNominationId} is null`,
      ),
    )
    .limit(1);
  if (!nomination?.nomineeXId) return;
  await db
    .update(builderXIdentities)
    .set({ builderId, updatedAt: new Date() })
    .where(eq(builderXIdentities.xUserId, nomination.nomineeXId));
}

function xNominationValues(
  input: XNominationInput,
  options: {
    id: string;
    apiKeyId: string;
    tokenHash: string | null;
    canonicalNominationId: string | null;
    canonical: boolean;
    completed: boolean;
  },
) {
  return {
    id: options.id,
    source: input.source,
    sourceNominationId: input.sourceNominationId,
    sourcePostUrl: input.sourcePostUrl,
    sourcePostText: input.sourcePostText,
    sourcePostCreatedAt: input.sourcePostCreatedAt ? new Date(input.sourcePostCreatedAt) : null,
    conversationId: input.conversationId,
    replyToPostId: input.replyToPostId,
    sourceNomineeXId: input.nomineeXId,
    sourceNomineeXUsername: displayXUsername(input.nomineeXUsername),
    nomineeXId: options.canonical ? input.nomineeXId : null,
    nomineeXUsername: options.canonical ? displayXUsername(input.nomineeXUsername) : null,
    nominatorXId: input.nominatedByXId,
    nominatorXUsername: displayXUsername(input.nominatedByXUsername),
    createdByApiKeyId: options.apiKeyId,
    tokenHash: options.tokenHash,
    canonicalNominationId: options.canonicalNominationId,
    engagementStatus: options.completed ? "completed" : "pending_contact",
    completedAt: options.completed ? new Date() : null,
    engagementUpdatedAt: new Date(),
  };
}

async function findXSource(executor: Executor, sourceNominationId: string, lock = false) {
  const query = executor
    .select()
    .from(builderNominations)
    .where(
      and(
        eq(builderNominations.source, "x"),
        eq(builderNominations.sourceNominationId, sourceNominationId),
      ),
    )
    .limit(1);
  const [row] = lock ? await query.for("update") : await query;
  return row ?? null;
}

async function insertXReferral(
  tx: Transaction,
  input: XNominationInput,
  canonical: NominationRow,
  apiKeyId: string,
  tokenSecret: string,
  nomineeIdentity: XIdentityRow,
): Promise<{ row: NominationRow; created: boolean }> {
  const id = randomNominationId();
  const needsOnboarding = !canonical.submittedAt && !nomineeIdentity.builderId;
  const tokenHash = needsOnboarding
    ? hashNominationToken(createNominationToken(tokenSecret, id))
    : null;
  const [inserted] = await tx
    .insert(builderNominations)
    .values(
      xNominationValues(input, {
        id,
        apiKeyId,
        tokenHash,
        canonicalNominationId: canonical.id,
        canonical: false,
        completed: Boolean(canonical.submittedAt),
      }),
    )
    .onConflictDoNothing()
    .returning();
  if (inserted) return { row: inserted, created: true };
  const concurrent = await findXSource(tx, input.sourceNominationId, true);
  if (!concurrent) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Could not record the X nomination referral",
    });
  }
  assertMatchingXNomination(concurrent, input);
  return { row: concurrent, created: false };
}

export async function createXNominationRecord(
  db: Database,
  input: {
    nomination: XNominationInput;
    apiKeyId: string;
    tokenSecret: string;
  },
): Promise<{ nominationId: string; created: boolean }> {
  assertXNomination(input.nomination);
  return db.transaction(async (tx) => {
    const existing = await findXSource(tx, input.nomination.sourceNominationId, true);
    if (existing) {
      assertMatchingXNomination(existing, input.nomination);
      return { nominationId: existing.id, created: false };
    }

    await upsertXIdentity(tx, {
      xUserId: input.nomination.nominatedByXId,
      username: input.nomination.nominatedByXUsername,
    });
    const nomineeIdentity = await upsertXIdentity(tx, {
      xUserId: input.nomination.nomineeXId,
      username: input.nomination.nomineeXUsername,
    });
    const [canonical] = await tx
      .select()
      .from(builderNominations)
      .where(eq(builderNominations.nomineeXId, input.nomination.nomineeXId))
      .for("update")
      .limit(1);
    if (canonical) {
      const referral = await insertXReferral(
        tx,
        input.nomination,
        canonical,
        input.apiKeyId,
        input.tokenSecret,
        nomineeIdentity,
      );
      return { nominationId: referral.row.id, created: referral.created };
    }

    const id = randomNominationId();
    const tokenHash = nomineeIdentity.builderId
      ? null
      : hashNominationToken(createNominationToken(input.tokenSecret, id));
    const [inserted] = await tx
      .insert(builderNominations)
      .values(
        xNominationValues(input.nomination, {
          id,
          apiKeyId: input.apiKeyId,
          tokenHash,
          canonicalNominationId: null,
          canonical: true,
          completed: false,
        }),
      )
      .onConflictDoNothing()
      .returning();
    if (inserted) return { nominationId: inserted.id, created: true };

    const concurrentSource = await findXSource(tx, input.nomination.sourceNominationId, true);
    if (concurrentSource) {
      assertMatchingXNomination(concurrentSource, input.nomination);
      return { nominationId: concurrentSource.id, created: false };
    }
    const [concurrentCanonical] = await tx
      .select()
      .from(builderNominations)
      .where(eq(builderNominations.nomineeXId, input.nomination.nomineeXId))
      .for("update")
      .limit(1);
    if (!concurrentCanonical) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Could not resolve the canonical X nomination",
      });
    }
    const referral = await insertXReferral(
      tx,
      input.nomination,
      concurrentCanonical,
      input.apiKeyId,
      input.tokenSecret,
      nomineeIdentity,
    );
    return { nominationId: referral.row.id, created: referral.created };
  });
}

export async function resolveNomination(
  db: Database,
  token: string,
  recordOpen: boolean,
): Promise<ResolvedNominationRecord | null> {
  const tokenHash = hashNominationToken(token);
  const [matched] = await db
    .select()
    .from(builderNominations)
    .where(eq(builderNominations.tokenHash, tokenHash))
    .limit(1);
  if (!matched) return null;
  const canonical = await resolveCanonicalNomination(db, matched);
  let referral = matched;
  if (recordOpen && matched.source === "x") {
    const now = new Date();
    const [opened] = await db
      .update(builderNominations)
      .set({
        firstOpenedAt: matched.firstOpenedAt ?? now,
        lastOpenedAt: now,
        openCount: sql`${builderNominations.openCount} + 1`,
      })
      .where(eq(builderNominations.id, matched.id))
      .returning();
    referral = opened ?? matched;
  }
  return { canonical, referral };
}

export async function finalizeNomination(
  db: Database,
  token: string,
  proposalId: string,
  nearAccount: string,
  userId: string,
): Promise<NominationMetadata> {
  const tokenHash = hashNominationToken(token);
  return db.transaction(async (tx) => {
    const [matched] = await tx
      .select()
      .from(builderNominations)
      .where(eq(builderNominations.tokenHash, tokenHash))
      .for("update")
      .limit(1);
    if (!matched) {
      throw new ORPCError("INVALID_NOMINATION", { message: "Nomination link is invalid" });
    }
    const canonical = await resolveCanonicalNomination(tx, matched, true);
    if (canonical.submittedAt) {
      if (
        canonical.proposalId === proposalId &&
        canonical.submittedNearAccount === nearAccount &&
        canonical.submittedUserId === userId
      ) {
        return nominationMetadata(canonical, matched);
      }
      throw new ORPCError("NOMINATION_CONFLICT", {
        message: "Nomination was submitted by another builder",
      });
    }

    const now = new Date();
    const [submitted] = await tx
      .update(builderNominations)
      .set({
        proposalId,
        submittedAt: now,
        submittedNearAccount: nearAccount,
        submittedUserId: userId,
      })
      .where(eq(builderNominations.id, canonical.id))
      .returning();
    if (!submitted) {
      throw new ORPCError("NOMINATION_CONFLICT", {
        message: "Nomination could not be finalized",
      });
    }
    if (canonical.source === "x") {
      const [builder] = await tx
        .select({ id: builders.id })
        .from(builders)
        .where(eq(builders.nearAccount, nearAccount))
        .limit(1);
      if (builder && canonical.nomineeXId) {
        await tx
          .update(builderXIdentities)
          .set({ builderId: builder.id, updatedAt: now })
          .where(eq(builderXIdentities.xUserId, canonical.nomineeXId));
      }
      await tx
        .update(builderNominations)
        .set({
          engagementStatus: "completed",
          completedAt: now,
          engagementUpdatedAt: now,
          updatedBy: userId,
        })
        .where(
          and(
            eq(builderNominations.source, "x"),
            or(
              eq(builderNominations.id, canonical.id),
              eq(builderNominations.canonicalNominationId, canonical.id),
            ),
          ),
        );
    }
    return nominationMetadata(submitted, matched);
  });
}
