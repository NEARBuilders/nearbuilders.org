import { randomBytes } from "node:crypto";
import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { builderNominations, builders } from "../db/schema";
import {
  createNominationToken,
  createXNominationRecord,
  finalizeNomination as finalizeNominationRecord,
  nominationMetadata as genericNominationMetadata,
  hashNominationToken,
  hasMatchingTokenHash,
  type NominationMetadata,
  resolveCanonicalNomination,
  resolveNomination as resolveNominationRecord,
  syncBuilderXIdentity,
  syncSubmittedXIdentity,
  type XNominationInput,
} from "./nominations";
import {
  getXNominationMetrics,
  listXNominationQueue,
  updateXNomination,
  type XNominationAdminAction,
  type XNominationEngagementStatusValue,
  type XNominationMetrics,
  type XNominationQueueRecord,
} from "./x-nomination-admin";

export type {
  NominationMetadata,
  XNominationInput,
  XReferralContext,
} from "./nominations";
export {
  createNominationToken,
  hashNominationToken,
} from "./nominations";
export type {
  XNominationAdminAction,
  XNominationEngagementStatusValue,
  XNominationMetrics,
  XNominationQueueRecord,
} from "./x-nomination-admin";
export { XNominationEngagementStatus } from "./x-nomination-admin";

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return typeof value === "string" ? value : value.toISOString();
}

function parseSkills(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLinks(raw: string | null): Record<string, string> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function serializeSkills(skills?: string[]): string {
  return JSON.stringify(skills ?? []);
}

function serializeLinks(links?: Record<string, string>): string | null {
  if (!links || Object.keys(links).length === 0) return null;
  return JSON.stringify(links);
}

export interface Builder {
  id: string;
  nearAccount: string;
  userId: string | null;
  name: string | null;
  bio: string | null;
  skills: string[];
  location: string | null;
  links: Record<string, string> | null;
  withdrawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Identity of whoever is asking, used to decide if a withdrawn profile may be returned. */
export interface BuilderViewer {
  userId?: string | null;
  walletAddress?: string | null;
  role?: string | null;
}

function isBuilderOwner(
  row: { nearAccount: string; userId: string | null },
  viewer?: BuilderViewer,
) {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  return (
    row.nearAccount === viewer.walletAddress ||
    row.nearAccount === viewer.userId ||
    (row.userId != null && row.userId === viewer.userId)
  );
}

function rowToBuilder(row: any): Builder {
  return {
    id: row.id,
    nearAccount: row.nearAccount,
    userId: row.userId ?? null,
    name: row.name ?? null,
    bio: row.bio ?? null,
    skills: parseSkills(row.skills),
    location: row.location ?? null,
    links: parseLinks(row.links),
    withdrawnAt: row.withdrawnAt ? toIsoString(row.withdrawnAt) : null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function generateId(): string {
  return `bld_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString("base64url")}`;
}

export interface TelegramNominationInput {
  source: "telegram";
  sourceNominationId: string;
  nomineeTelegramId: number | null;
  nomineeUsername: string | null;
  nominatedByTelegramId: number;
  telegramGroupId: number;
}

export interface TelegramNominationClaimInput {
  nominationId?: string;
  nomineeTelegramId: number;
  nomineeUsername: string | null;
}

export interface TelegramNominationMetadata {
  nominationId: string;
  source: "telegram";
}

interface CreateXNominationInput {
  nomination: XNominationInput;
  apiKeyId: string;
  tokenSecret: string;
}

interface CreatedXNomination {
  nominationId: string;
  created: boolean;
}

type ResolvedNomination =
  | ({ status: "ready" | "submitted" } & NominationMetadata)
  | { status: "invalid" };

interface CreateTelegramNominationInput {
  nomination: TelegramNominationInput;
  apiKeyId: string;
  joinBaseUrl: string;
  tokenSecret: string;
}

interface CreatedTelegramNomination {
  nominationId: string;
  status: "awaiting_claim" | "awaiting_profile" | "submitted";
  joinUrl?: string;
  proposalId: string | null;
  proposalEntityId: string | null;
  created: boolean;
}

type TelegramNominationResult = Omit<CreatedTelegramNomination, "created">;

type ResolvedTelegramNomination =
  | ({ status: "ready" | "submitted" } & TelegramNominationMetadata)
  | { status: "invalid" };

function telegramNominationMetadata(
  row: typeof builderNominations.$inferSelect,
): TelegramNominationMetadata {
  return {
    nominationId: row.id,
    source: "telegram",
  };
}

function normalizeTelegramUsername(username: string): string {
  return username.trim().toLowerCase();
}

function assertMatchingNomination(
  existing: typeof builderNominations.$inferSelect,
  input: TelegramNominationInput,
) {
  const inputUsername = input.nomineeUsername
    ? normalizeTelegramUsername(input.nomineeUsername)
    : null;
  const matches =
    existing.sourceNomineeTelegramId === input.nomineeTelegramId &&
    (input.nomineeTelegramId !== null ||
      existing.sourceNomineeUsernameNormalized === inputUsername) &&
    existing.nominatedByTelegramId === input.nominatedByTelegramId &&
    existing.telegramGroupId === input.telegramGroupId;

  if (!matches) {
    throw new ORPCError("IDEMPOTENCY_CONFLICT", {
      message: "The nomination identifier was already used with different data",
    });
  }
}

function buildJoinUrl(joinBaseUrl: string, token: string): string {
  const url = new URL("/join", joinBaseUrl);
  if (url.protocol !== "https:") {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Nomination join URL must use HTTPS",
    });
  }
  url.searchParams.set("nomination", token);
  return url.toString();
}

function nominationResult(
  nomination: typeof builderNominations.$inferSelect,
  joinBaseUrl: string,
  tokenSecret: string,
): TelegramNominationResult {
  if (nomination.canonicalNominationId) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Nomination claim handle was not resolved to its canonical nomination",
    });
  }

  if (nomination.submittedAt || nomination.proposalId || nomination.submittedNearAccount) {
    if (!nomination.submittedAt || !nomination.proposalId || !nomination.submittedNearAccount) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Submitted nomination is missing its linked proposal",
      });
    }
    return {
      nominationId: nomination.id,
      status: "submitted",
      proposalId: nomination.proposalId,
      proposalEntityId: nomination.submittedNearAccount.toLowerCase(),
    };
  }

  if (nomination.nomineeTelegramId === null) {
    return {
      nominationId: nomination.id,
      status: "awaiting_claim",
      proposalId: null,
      proposalEntityId: null,
    };
  }

  if (!nomination.tokenHash) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Verified nomination is missing its onboarding token",
    });
  }

  const token = createNominationToken(tokenSecret, nomination.id);
  if (!hasMatchingTokenHash(token, nomination.tokenHash)) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Nomination token secret does not match the stored invitation",
    });
  }

  return {
    nominationId: nomination.id,
    status: "awaiting_profile",
    joinUrl: buildJoinUrl(joinBaseUrl, token),
    proposalId: null,
    proposalEntityId: null,
  };
}

export class BuilderService extends Context.Tag("builders/BuilderService")<
  BuilderService,
  {
    listBuilders: (input: {
      search?: string;
      skill?: string;
      limit?: number;
      cursor?: string;
    }) => Effect.Effect<
      {
        data: Builder[];
        meta: { total: number; hasMore: boolean; nextCursor: string | null };
      },
      ORPCError<string, unknown>
    >;

    getBuilder: (
      nearAccount: string,
      viewer?: BuilderViewer,
    ) => Effect.Effect<Builder | null, ORPCError<string, unknown>>;

    getBuilderByUserId: (
      userId: string,
      walletAddress?: string,
    ) => Effect.Effect<Builder | null, ORPCError<string, unknown>>;

    setBuilderWithdrawn: (
      viewer: { userId: string; walletAddress?: string },
      withdrawn: boolean,
    ) => Effect.Effect<Builder, ORPCError<string, unknown>>;

    createBuilder: (input: {
      nearAccount: string;
      userId?: string;
      name?: string;
      bio?: string;
      skills?: string[];
      location?: string;
      links?: Record<string, string>;
    }) => Effect.Effect<Builder, ORPCError<string, unknown>>;

    updateBuilderProfile: (
      nearAccount: string,
      input: {
        name?: string;
        bio?: string;
        skills?: string[];
        location?: string;
        links?: Record<string, string>;
      },
      userId: string,
      walletAddress?: string,
      _userRole?: string,
    ) => Effect.Effect<Builder, ORPCError<string, unknown>>;

    deleteBuilder: (
      nearAccount: string,
    ) => Effect.Effect<{ deleted: boolean }, ORPCError<string, unknown>>;

    createXNomination: (
      input: CreateXNominationInput,
    ) => Effect.Effect<CreatedXNomination, ORPCError<string, unknown>>;

    resolveNomination: (
      token: string,
      recordOpen?: boolean,
    ) => Effect.Effect<ResolvedNomination, ORPCError<string, unknown>>;

    finalizeNomination: (
      token: string,
      proposalId: string,
      nearAccount: string,
      userId: string,
    ) => Effect.Effect<NominationMetadata, ORPCError<string, unknown>>;

    listXNominationQueue: (input: {
      status?: XNominationEngagementStatusValue;
      search?: string;
      limit?: number;
      cursor?: string;
      joinBaseUrl: string;
      tokenSecret: string;
    }) => Effect.Effect<
      {
        data: XNominationQueueRecord[];
        meta: { total: number; hasMore: boolean; nextCursor: string | null };
      },
      ORPCError<string, unknown>
    >;

    updateXNomination: (input: {
      nominationId: string;
      expectedEngagementUpdatedAt: string;
      action: XNominationAdminAction;
      replyUrl?: string;
      actorUserId: string;
      joinBaseUrl: string;
      tokenSecret: string;
    }) => Effect.Effect<XNominationQueueRecord, ORPCError<string, unknown>>;

    getXNominationMetrics: () => Effect.Effect<XNominationMetrics, ORPCError<string, unknown>>;

    createTelegramNomination: (
      input: CreateTelegramNominationInput,
    ) => Effect.Effect<CreatedTelegramNomination, ORPCError<string, unknown>>;

    claimTelegramNomination: (
      input: TelegramNominationClaimInput & { joinBaseUrl: string; tokenSecret: string },
    ) => Effect.Effect<TelegramNominationResult, ORPCError<string, unknown>>;

    resolveTelegramNomination: (
      token: string,
    ) => Effect.Effect<ResolvedTelegramNomination, ORPCError<string, unknown>>;

    finalizeTelegramNomination: (
      token: string,
      proposalId: string,
      nearAccount: string,
      userId: string,
    ) => Effect.Effect<TelegramNominationMetadata, ORPCError<string, unknown>>;
  }
>() {}

export const BuilderServiceLive = Layer.effect(
  BuilderService,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    return {
      listBuilders: (input) =>
        Effect.gen(function* () {
          const limit = Math.min(input.limit ?? 24, 100);
          const offset = input.cursor ? parseInt(input.cursor, 10) : 0;
          const conditions: any[] = [isNull(builders.withdrawnAt)];

          if (input.search) {
            const pattern = `%${input.search}%`;
            conditions.push(
              or(
                ilike(builders.nearAccount, pattern),
                ilike(builders.name, pattern),
                ilike(builders.bio, pattern),
                ilike(builders.location, pattern),
                ilike(builders.skills, pattern),
              ),
            );
          }

          if (input.skill) {
            conditions.push(ilike(builders.skills, `%${input.skill}%`));
          }

          const whereClause = and(...conditions);

          const [totalResult] = yield* Effect.promise(() =>
            db.select({ count: count() }).from(builders).where(whereClause),
          );

          const total = totalResult?.count ?? 0;

          const records = yield* Effect.promise(() =>
            db
              .select()
              .from(builders)
              .where(whereClause)
              .orderBy(desc(builders.createdAt))
              .limit(limit)
              .offset(offset),
          );

          const nextOffset = offset + limit;
          const hasMore = nextOffset < total;

          return {
            data: records.map(rowToBuilder),
            meta: {
              total,
              hasMore,
              nextCursor: hasMore ? String(nextOffset) : null,
            },
          };
        }),

      getBuilder: (nearAccount, viewer) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );
          if (!row) return null;
          // A withdrawn profile is only visible to its owner (or an admin).
          if (row.withdrawnAt && !isBuilderOwner(row, viewer)) return null;
          return rowToBuilder(row);
        }),

      getBuilderByUserId: (userId, walletAddress) =>
        Effect.gen(function* () {
          const conditions: any[] = [];
          if (walletAddress) conditions.push(eq(builders.nearAccount, walletAddress));
          conditions.push(eq(builders.userId, userId));

          const [row] = yield* Effect.promise(() =>
            db
              .select()
              .from(builders)
              .where(and(or(...conditions)))
              .limit(1),
          );
          return row ? rowToBuilder(row) : null;
        }),

      createBuilder: (input) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, input.nearAccount)).limit(1),
          );

          if (existing) {
            const now = new Date();
            yield* Effect.promise(() =>
              db
                .update(builders)
                .set({
                  userId: input.userId ?? existing.userId,
                  name: input.name?.trim() ?? existing.name,
                  bio: input.bio?.trim() ?? existing.bio,
                  skills:
                    input.skills !== undefined ? serializeSkills(input.skills) : existing.skills,
                  location: input.location?.trim() ?? existing.location,
                  links: input.links !== undefined ? serializeLinks(input.links) : existing.links,
                  updatedAt: now,
                })
                .where(eq(builders.nearAccount, input.nearAccount)),
            );

            const [updated] = yield* Effect.promise(() =>
              db
                .select()
                .from(builders)
                .where(eq(builders.nearAccount, input.nearAccount))
                .limit(1),
            );

            if (!updated) {
              return yield* Effect.fail(
                new ORPCError("INTERNAL_SERVER_ERROR", {
                  message: "Builder profile disappeared after update",
                }),
              );
            }
            yield* Effect.promise(() =>
              syncBuilderXIdentity(db, updated.id, parseLinks(updated.links)),
            );
            yield* Effect.promise(() =>
              syncSubmittedXIdentity(db, updated.id, updated.nearAccount),
            );
            return rowToBuilder(updated);
          }

          const now = new Date();
          const id = generateId();

          yield* Effect.promise(() =>
            db.insert(builders).values({
              id,
              nearAccount: input.nearAccount,
              userId: input.userId ?? null,
              name: input.name?.trim() ?? null,
              bio: input.bio?.trim() ?? null,
              skills: serializeSkills(input.skills),
              location: input.location?.trim() ?? null,
              links: serializeLinks(input.links),
              createdAt: now,
              updatedAt: now,
            }),
          );
          yield* Effect.promise(() => syncBuilderXIdentity(db, id, input.links ?? null));
          yield* Effect.promise(() => syncSubmittedXIdentity(db, id, input.nearAccount));

          return {
            id,
            nearAccount: input.nearAccount,
            userId: input.userId ?? null,
            name: input.name?.trim() ?? null,
            bio: input.bio?.trim() ?? null,
            skills: input.skills ?? [],
            location: input.location?.trim() ?? null,
            links: input.links && Object.keys(input.links).length > 0 ? input.links : null,
            withdrawnAt: null,
            createdAt: toIsoString(now),
            updatedAt: toIsoString(now),
          };
        }),

      updateBuilderProfile: (nearAccount, input, userId, walletAddress, _userRole) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Builder profile not found" }),
            );
          }

          const isOwner =
            existing.nearAccount === walletAddress ||
            existing.nearAccount === userId ||
            existing.userId === userId;

          if (!isOwner) {
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "You do not have permission to edit this profile",
              }),
            );
          }

          const now = new Date();
          const updates: any = { updatedAt: now };

          if (input.name !== undefined) updates.name = input.name.trim() || null;
          if (input.bio !== undefined) updates.bio = input.bio.trim() || null;
          if (input.skills !== undefined) updates.skills = serializeSkills(input.skills);
          if (input.location !== undefined) updates.location = input.location.trim() || null;
          if (input.links !== undefined) updates.links = serializeLinks(input.links);

          yield* Effect.promise(() =>
            db.update(builders).set(updates).where(eq(builders.nearAccount, nearAccount)),
          );

          const [updated] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );
          if (!updated) {
            return yield* Effect.fail(
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Builder profile disappeared after update",
              }),
            );
          }
          yield* Effect.promise(() =>
            syncBuilderXIdentity(db, updated.id, parseLinks(updated.links)),
          );
          yield* Effect.promise(() => syncSubmittedXIdentity(db, updated.id, updated.nearAccount));
          return rowToBuilder(updated);
        }),

      deleteBuilder: (nearAccount) =>
        Effect.gen(function* () {
          const [existing] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "Builder profile not found" }),
            );
          }

          yield* Effect.promise(() =>
            db.delete(builders).where(eq(builders.nearAccount, nearAccount)),
          );

          return { deleted: true };
        }),

      setBuilderWithdrawn: (viewer, withdrawn) =>
        Effect.gen(function* () {
          const conditions: any[] = [eq(builders.userId, viewer.userId)];
          if (viewer.walletAddress) conditions.push(eq(builders.nearAccount, viewer.walletAddress));

          const [existing] = yield* Effect.promise(() =>
            db
              .select()
              .from(builders)
              .where(or(...conditions))
              .limit(1),
          );

          if (!existing) {
            return yield* Effect.fail(
              new ORPCError("NOT_FOUND", { message: "You do not have a builder profile" }),
            );
          }

          yield* Effect.promise(() =>
            db
              .update(builders)
              .set({ withdrawnAt: withdrawn ? new Date() : null, updatedAt: new Date() })
              .where(eq(builders.id, existing.id)),
          );

          const [updated] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.id, existing.id)).limit(1),
          );
          if (!updated) {
            return yield* Effect.fail(
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Builder profile disappeared after update",
              }),
            );
          }
          return rowToBuilder(updated);
        }),

      createXNomination: (input) => Effect.promise(() => createXNominationRecord(db, input)),

      resolveNomination: (token, recordOpen = true) =>
        Effect.gen(function* () {
          const result = yield* Effect.promise(() =>
            resolveNominationRecord(db, token, recordOpen),
          );
          if (!result) return { status: "invalid" as const };
          return {
            ...genericNominationMetadata(result.canonical, result.referral),
            status: result.canonical.submittedAt ? ("submitted" as const) : ("ready" as const),
          };
        }),

      finalizeNomination: (token, proposalId, nearAccount, userId) =>
        Effect.promise(() => finalizeNominationRecord(db, token, proposalId, nearAccount, userId)),

      listXNominationQueue: (input) => Effect.promise(() => listXNominationQueue(db, input)),

      updateXNomination: (input) => Effect.promise(() => updateXNomination(db, input)),

      getXNominationMetrics: () => Effect.promise(() => getXNominationMetrics(db)),

      createTelegramNomination: (input) =>
        Effect.gen(function* () {
          const nominationId = randomId("nom");
          const normalizedUsername = input.nomination.nomineeUsername
            ? normalizeTelegramUsername(input.nomination.nomineeUsername)
            : null;
          const tokenHash =
            input.nomination.nomineeTelegramId === null
              ? null
              : hashNominationToken(createNominationToken(input.tokenSecret, nominationId));

          const result = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const resolveCanonical = (initial: typeof builderNominations.$inferSelect) =>
                resolveCanonicalNomination(tx, initial, true);

              const [sourceMatch] = await tx
                .select()
                .from(builderNominations)
                .where(
                  and(
                    eq(builderNominations.source, input.nomination.source),
                    eq(builderNominations.sourceNominationId, input.nomination.sourceNominationId),
                  ),
                )
                .for("update")
                .limit(1);

              if (sourceMatch) {
                assertMatchingNomination(sourceMatch, input.nomination);
                const canonical = await resolveCanonical(sourceMatch);
                if (
                  input.nomination.nomineeTelegramId !== null &&
                  canonical.nomineeUsername !== input.nomination.nomineeUsername
                ) {
                  const [updated] = await tx
                    .update(builderNominations)
                    .set({ nomineeUsername: input.nomination.nomineeUsername })
                    .where(eq(builderNominations.id, canonical.id))
                    .returning();
                  if (updated) return { nomination: updated, created: false };
                }
                return { nomination: canonical, created: false };
              }

              const [canonicalMatch] =
                input.nomination.nomineeTelegramId !== null
                  ? await tx
                      .select()
                      .from(builderNominations)
                      .where(
                        eq(
                          builderNominations.nomineeTelegramId,
                          input.nomination.nomineeTelegramId,
                        ),
                      )
                      .for("update")
                      .limit(1)
                  : await tx
                      .select()
                      .from(builderNominations)
                      .where(
                        eq(builderNominations.unresolvedUsernameNormalized, normalizedUsername!),
                      )
                      .for("update")
                      .limit(1);

              if (canonicalMatch) {
                const handleId = randomId("nom");
                const [insertedHandle] = await tx
                  .insert(builderNominations)
                  .values({
                    id: handleId,
                    source: input.nomination.source,
                    sourceNominationId: input.nomination.sourceNominationId,
                    sourceNomineeTelegramId: input.nomination.nomineeTelegramId,
                    sourceNomineeUsernameNormalized: normalizedUsername,
                    nomineeTelegramId: null,
                    nomineeUsername: input.nomination.nomineeUsername,
                    unresolvedUsernameNormalized: null,
                    nominatedByTelegramId: input.nomination.nominatedByTelegramId,
                    telegramGroupId: input.nomination.telegramGroupId,
                    createdByApiKeyId: input.apiKeyId,
                    tokenHash: null,
                    canonicalNominationId: canonicalMatch.id,
                  })
                  .onConflictDoNothing()
                  .returning();

                if (!insertedHandle) {
                  const [concurrentSource] = await tx
                    .select()
                    .from(builderNominations)
                    .where(
                      and(
                        eq(builderNominations.source, input.nomination.source),
                        eq(
                          builderNominations.sourceNominationId,
                          input.nomination.sourceNominationId,
                        ),
                      ),
                    )
                    .for("update")
                    .limit(1);
                  if (!concurrentSource) {
                    throw new ORPCError("INTERNAL_SERVER_ERROR", {
                      message: "Could not record the nomination source",
                    });
                  }
                  assertMatchingNomination(concurrentSource, input.nomination);
                  return {
                    nomination: await resolveCanonical(concurrentSource),
                    created: false,
                  };
                }

                if (
                  input.nomination.nomineeTelegramId !== null &&
                  canonicalMatch.nomineeUsername !== input.nomination.nomineeUsername
                ) {
                  const [updated] = await tx
                    .update(builderNominations)
                    .set({ nomineeUsername: input.nomination.nomineeUsername })
                    .where(eq(builderNominations.id, canonicalMatch.id))
                    .returning();
                  if (updated) return { nomination: updated, created: false };
                }
                return { nomination: canonicalMatch, created: false };
              }

              const [inserted] = await tx
                .insert(builderNominations)
                .values({
                  id: nominationId,
                  source: input.nomination.source,
                  sourceNominationId: input.nomination.sourceNominationId,
                  sourceNomineeTelegramId: input.nomination.nomineeTelegramId,
                  sourceNomineeUsernameNormalized: normalizedUsername,
                  nomineeTelegramId: input.nomination.nomineeTelegramId,
                  nomineeUsername: input.nomination.nomineeUsername,
                  unresolvedUsernameNormalized:
                    input.nomination.nomineeTelegramId === null ? normalizedUsername : null,
                  nominatedByTelegramId: input.nomination.nominatedByTelegramId,
                  telegramGroupId: input.nomination.telegramGroupId,
                  createdByApiKeyId: input.apiKeyId,
                  tokenHash,
                })
                .onConflictDoNothing()
                .returning();

              if (inserted) {
                return { nomination: inserted, created: true };
              }

              const [existingSource] = await tx
                .select()
                .from(builderNominations)
                .where(
                  and(
                    eq(builderNominations.source, input.nomination.source),
                    eq(builderNominations.sourceNominationId, input.nomination.sourceNominationId),
                  ),
                )
                .for("update")
                .limit(1);

              if (existingSource) {
                assertMatchingNomination(existingSource, input.nomination);
                return {
                  nomination: await resolveCanonical(existingSource),
                  created: false,
                };
              }

              const [concurrentCanonical] =
                input.nomination.nomineeTelegramId !== null
                  ? await tx
                      .select()
                      .from(builderNominations)
                      .where(
                        eq(
                          builderNominations.nomineeTelegramId,
                          input.nomination.nomineeTelegramId,
                        ),
                      )
                      .for("update")
                      .limit(1)
                  : await tx
                      .select()
                      .from(builderNominations)
                      .where(
                        eq(builderNominations.unresolvedUsernameNormalized, normalizedUsername!),
                      )
                      .for("update")
                      .limit(1);

              if (!concurrentCanonical) {
                throw new ORPCError("INTERNAL_SERVER_ERROR", {
                  message: "Could not resolve the existing nomination",
                });
              }

              const handleId = randomId("nom");
              const [insertedHandle] = await tx
                .insert(builderNominations)
                .values({
                  id: handleId,
                  source: input.nomination.source,
                  sourceNominationId: input.nomination.sourceNominationId,
                  sourceNomineeTelegramId: input.nomination.nomineeTelegramId,
                  sourceNomineeUsernameNormalized: normalizedUsername,
                  nomineeTelegramId: null,
                  nomineeUsername: input.nomination.nomineeUsername,
                  unresolvedUsernameNormalized: null,
                  nominatedByTelegramId: input.nomination.nominatedByTelegramId,
                  telegramGroupId: input.nomination.telegramGroupId,
                  createdByApiKeyId: input.apiKeyId,
                  tokenHash: null,
                  canonicalNominationId: concurrentCanonical.id,
                })
                .onConflictDoNothing()
                .returning();
              if (!insertedHandle) {
                const [concurrentSource] = await tx
                  .select()
                  .from(builderNominations)
                  .where(
                    and(
                      eq(builderNominations.source, input.nomination.source),
                      eq(
                        builderNominations.sourceNominationId,
                        input.nomination.sourceNominationId,
                      ),
                    ),
                  )
                  .for("update")
                  .limit(1);
                if (!concurrentSource) {
                  throw new ORPCError("INTERNAL_SERVER_ERROR", {
                    message: "Could not record the nomination source",
                  });
                }
                assertMatchingNomination(concurrentSource, input.nomination);
                return {
                  nomination: await resolveCanonical(concurrentSource),
                  created: false,
                };
              }
              return { nomination: concurrentCanonical, created: false };
            }),
          );

          return {
            ...nominationResult(result.nomination, input.joinBaseUrl, input.tokenSecret),
            created: result.created,
          };
        }),

      claimTelegramNomination: (input) =>
        Effect.gen(function* () {
          const result = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const resolveCanonical = (initial: typeof builderNominations.$inferSelect) =>
                resolveCanonicalNomination(tx, initial, true);

              const updateVerifiedUsername = async (
                nomination: typeof builderNominations.$inferSelect,
              ) => {
                if (nomination.nomineeUsername === input.nomineeUsername) return nomination;
                const [updated] = await tx
                  .update(builderNominations)
                  .set({ nomineeUsername: input.nomineeUsername })
                  .where(eq(builderNominations.id, nomination.id))
                  .returning();
                return updated ?? nomination;
              };

              const linkClaimHandle = async (
                nomination: typeof builderNominations.$inferSelect,
                canonicalNominationId: string,
              ) => {
                await tx
                  .update(builderNominations)
                  .set({
                    nomineeUsername: input.nomineeUsername,
                    unresolvedUsernameNormalized: null,
                    canonicalNominationId,
                    tokenHash: null,
                  })
                  .where(eq(builderNominations.id, nomination.id));
              };

              const claimUnresolved = async (
                nomination: typeof builderNominations.$inferSelect,
              ) => {
                const normalizedUsername = input.nomineeUsername
                  ? normalizeTelegramUsername(input.nomineeUsername)
                  : null;
                if (
                  !normalizedUsername ||
                  nomination.unresolvedUsernameNormalized !== normalizedUsername
                ) {
                  throw new ORPCError("FORBIDDEN", {
                    message: "Nomination does not belong to this Telegram user",
                  });
                }

                const [existingCanonical] = await tx
                  .select()
                  .from(builderNominations)
                  .where(eq(builderNominations.nomineeTelegramId, input.nomineeTelegramId))
                  .for("update")
                  .limit(1);

                if (existingCanonical && existingCanonical.id !== nomination.id) {
                  await linkClaimHandle(nomination, existingCanonical.id);
                  return await updateVerifiedUsername(existingCanonical);
                }

                const token = createNominationToken(input.tokenSecret, nomination.id);
                const [claimed] = await tx
                  .update(builderNominations)
                  .set({
                    nomineeTelegramId: input.nomineeTelegramId,
                    nomineeUsername: input.nomineeUsername,
                    unresolvedUsernameNormalized: null,
                    tokenHash: hashNominationToken(token),
                  })
                  .where(eq(builderNominations.id, nomination.id))
                  .returning();
                if (!claimed) {
                  throw new ORPCError("INTERNAL_SERVER_ERROR", {
                    message: "Could not claim the nomination",
                  });
                }
                return claimed;
              };

              if (input.nominationId) {
                const [named] = await tx
                  .select()
                  .from(builderNominations)
                  .where(eq(builderNominations.id, input.nominationId))
                  .for("update")
                  .limit(1);
                if (!named) {
                  throw new ORPCError("NOMINATION_NOT_FOUND", {
                    message: "Nomination not found",
                  });
                }
                const canonical = await resolveCanonical(named);
                if (canonical.nomineeTelegramId !== null) {
                  if (canonical.nomineeTelegramId !== input.nomineeTelegramId) {
                    throw new ORPCError("FORBIDDEN", {
                      message: "Nomination does not belong to this Telegram user",
                    });
                  }
                  return await updateVerifiedUsername(canonical);
                }
                return await claimUnresolved(canonical);
              }

              const [existingCanonical] = await tx
                .select()
                .from(builderNominations)
                .where(eq(builderNominations.nomineeTelegramId, input.nomineeTelegramId))
                .limit(1);
              if (existingCanonical) {
                if (input.nomineeUsername) {
                  const normalizedUsername = normalizeTelegramUsername(input.nomineeUsername);
                  const [unresolved] = await tx
                    .select()
                    .from(builderNominations)
                    .where(eq(builderNominations.unresolvedUsernameNormalized, normalizedUsername))
                    .for("update")
                    .limit(1);
                  if (unresolved) await linkClaimHandle(unresolved, existingCanonical.id);
                }
                return await updateVerifiedUsername(existingCanonical);
              }

              if (!input.nomineeUsername) {
                throw new ORPCError("NOMINATION_NOT_FOUND", {
                  message: "Nomination not found",
                });
              }
              const normalizedUsername = normalizeTelegramUsername(input.nomineeUsername);
              const [unresolved] = await tx
                .select()
                .from(builderNominations)
                .where(eq(builderNominations.unresolvedUsernameNormalized, normalizedUsername))
                .for("update")
                .limit(1);
              if (!unresolved) {
                throw new ORPCError("NOMINATION_NOT_FOUND", {
                  message: "Nomination not found",
                });
              }
              return await claimUnresolved(unresolved);
            }),
          );

          return nominationResult(result, input.joinBaseUrl, input.tokenSecret);
        }),

      resolveTelegramNomination: (token) =>
        Effect.gen(function* () {
          const result = yield* Effect.promise(() => resolveNominationRecord(db, token, false));
          if (!result || result.canonical.source !== "telegram") {
            return { status: "invalid" as const };
          }
          return {
            ...telegramNominationMetadata(result.canonical),
            status: result.canonical.submittedAt ? ("submitted" as const) : ("ready" as const),
          };
        }),

      finalizeTelegramNomination: (token, proposalId, nearAccount, userId) =>
        Effect.gen(function* () {
          const result = yield* Effect.promise(() =>
            finalizeNominationRecord(db, token, proposalId, nearAccount, userId),
          );
          if (result.source !== "telegram") {
            return yield* Effect.fail(
              new ORPCError("INVALID_NOMINATION", {
                message: "Nomination link is not a Telegram nomination",
              }),
            );
          }
          return {
            nominationId: result.nominationId,
            source: "telegram" as const,
          };
        }),
    };
  }),
);
