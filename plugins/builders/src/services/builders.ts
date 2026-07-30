import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { builderNominations, builders } from "../db/schema";

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
  createdAt: string;
  updatedAt: string;
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

export function hashNominationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createNominationToken(tokenSecret: string, nominationId: string): string {
  return createHmac("sha256", tokenSecret)
    .update(`telegram-nomination:v1:${nominationId}`, "utf8")
    .digest("base64url");
}

export interface TelegramNominationInput {
  source: "telegram";
  sourceNominationId: string;
  nomineeTelegramId: number;
  nomineeUsername: string | null;
  nominatedByTelegramId: number;
  telegramGroupId: number;
}

export interface TelegramNominationMetadata {
  nominationId: string;
  source: "telegram";
}

interface CreateTelegramNominationInput {
  nomination: TelegramNominationInput;
  apiKeyId: string;
  joinBaseUrl: string;
  tokenSecret: string;
}

interface CreatedTelegramNomination {
  nominationId: string;
  joinUrl: string;
  created: boolean;
}

type ResolvedTelegramNomination =
  | ({ status: "ready" | "submitted" } & TelegramNominationMetadata)
  | { status: "invalid" };

function nominationMetadata(
  row: typeof builderNominations.$inferSelect,
): TelegramNominationMetadata {
  return {
    nominationId: row.id,
    source: "telegram",
  };
}

function hasMatchingTokenHash(token: string, storedHash: string): boolean {
  const expected = Buffer.from(hashNominationToken(token), "hex");
  const actual = Buffer.from(storedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function assertMatchingNomination(
  existing: typeof builderNominations.$inferSelect,
  input: TelegramNominationInput,
) {
  const matches =
    existing.nomineeTelegramId === input.nomineeTelegramId &&
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

    getBuilder: (nearAccount: string) => Effect.Effect<Builder | null, ORPCError<string, unknown>>;

    getBuilderByUserId: (
      userId: string,
      walletAddress?: string,
    ) => Effect.Effect<Builder | null, ORPCError<string, unknown>>;

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

    createTelegramNomination: (
      input: CreateTelegramNominationInput,
    ) => Effect.Effect<CreatedTelegramNomination, ORPCError<string, unknown>>;

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
          const conditions: any[] = [];

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

      getBuilder: (nearAccount) =>
        Effect.gen(function* () {
          const [row] = yield* Effect.promise(() =>
            db.select().from(builders).where(eq(builders.nearAccount, nearAccount)).limit(1),
          );
          return row ? rowToBuilder(row) : null;
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

          return {
            id,
            nearAccount: input.nearAccount,
            userId: input.userId ?? null,
            name: input.name?.trim() ?? null,
            bio: input.bio?.trim() ?? null,
            skills: input.skills ?? [],
            location: input.location?.trim() ?? null,
            links: input.links && Object.keys(input.links).length > 0 ? input.links : null,
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

      createTelegramNomination: (input) =>
        Effect.gen(function* () {
          const nominationId = randomId("nom");
          const token = createNominationToken(input.tokenSecret, nominationId);
          const tokenHash = hashNominationToken(token);

          const result = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const [inserted] = await tx
                .insert(builderNominations)
                .values({
                  id: nominationId,
                  source: input.nomination.source,
                  sourceNominationId: input.nomination.sourceNominationId,
                  nomineeTelegramId: input.nomination.nomineeTelegramId,
                  nomineeUsername: input.nomination.nomineeUsername,
                  nominatedByTelegramId: input.nomination.nominatedByTelegramId,
                  telegramGroupId: input.nomination.telegramGroupId,
                  createdByApiKeyId: input.apiKeyId,
                  tokenHash,
                })
                .onConflictDoNothing({
                  target: [builderNominations.source, builderNominations.sourceNominationId],
                })
                .returning();

              if (inserted) {
                return {
                  nominationId: inserted.id,
                  tokenHash: inserted.tokenHash,
                  created: true,
                };
              }

              const [existing] = await tx
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

              if (!existing) {
                throw new ORPCError("INTERNAL_SERVER_ERROR", {
                  message: "Could not resolve the existing nomination",
                });
              }

              assertMatchingNomination(existing, input.nomination);
              if (existing.nomineeUsername !== input.nomination.nomineeUsername) {
                await tx
                  .update(builderNominations)
                  .set({ nomineeUsername: input.nomination.nomineeUsername })
                  .where(eq(builderNominations.id, existing.id));
              }

              return {
                nominationId: existing.id,
                tokenHash: existing.tokenHash,
                created: false,
              };
            }),
          );

          const stableToken = createNominationToken(input.tokenSecret, result.nominationId);
          if (!hasMatchingTokenHash(stableToken, result.tokenHash)) {
            return yield* Effect.fail(
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Nomination token secret does not match the stored invitation",
              }),
            );
          }

          return {
            nominationId: result.nominationId,
            joinUrl: buildJoinUrl(input.joinBaseUrl, stableToken),
            created: result.created,
          };
        }),

      resolveTelegramNomination: (token) =>
        Effect.gen(function* () {
          const tokenHash = hashNominationToken(token);
          const [nomination] = yield* Effect.promise(() =>
            db
              .select()
              .from(builderNominations)
              .where(eq(builderNominations.tokenHash, tokenHash))
              .limit(1),
          );

          if (!nomination) return { status: "invalid" as const };
          return {
            ...nominationMetadata(nomination),
            status: nomination.submittedAt ? ("submitted" as const) : ("ready" as const),
          };
        }),

      finalizeTelegramNomination: (token, proposalId, nearAccount, userId) =>
        Effect.gen(function* () {
          const now = new Date();
          const tokenHash = hashNominationToken(token);

          const result = yield* Effect.promise(() =>
            db.transaction(async (tx) => {
              const [nomination] = await tx
                .select()
                .from(builderNominations)
                .where(eq(builderNominations.tokenHash, tokenHash))
                .for("update")
                .limit(1);

              if (!nomination) {
                throw new ORPCError("INVALID_NOMINATION", {
                  message: "Nomination link is invalid",
                });
              }

              if (nomination.submittedAt) {
                if (
                  nomination.proposalId === proposalId &&
                  nomination.submittedNearAccount === nearAccount &&
                  nomination.submittedUserId === userId
                ) {
                  return nomination;
                }
                throw new ORPCError("NOMINATION_CONFLICT", {
                  message: "Nomination was submitted by another builder",
                });
              }

              const [submitted] = await tx
                .update(builderNominations)
                .set({
                  proposalId,
                  submittedAt: now,
                  submittedNearAccount: nearAccount,
                  submittedUserId: userId,
                })
                .where(
                  and(
                    eq(builderNominations.id, nomination.id),
                    eq(builderNominations.tokenHash, tokenHash),
                  ),
                )
                .returning();

              if (!submitted) {
                throw new ORPCError("NOMINATION_CONFLICT", {
                  message: "Nomination could not be finalized",
                });
              }

              return submitted;
            }),
          );

          return nominationMetadata(result);
        }),
    };
  }),
);
