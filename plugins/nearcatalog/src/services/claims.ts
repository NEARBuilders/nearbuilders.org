import { and, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { CatalogClaimHistorySchema, CatalogClaimSchema } from "../contract";
import type { NearCatalogDatabase } from "../db";
import { nearcatalogClaimHistory, nearcatalogClaims } from "../db/schema";
import { catalogClaimId } from "../project-reference";

export type CatalogClaim = z.infer<typeof CatalogClaimSchema>;
export type CatalogClaimHistory = z.infer<typeof CatalogClaimHistorySchema>;
type CatalogClaimHistoryAction = CatalogClaimHistory["action"];

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToClaim(row: typeof nearcatalogClaims.$inferSelect): CatalogClaim {
  return {
    id: row.id,
    nearAccount: row.nearAccount,
    projectSlug: row.projectSlug,
    roles: row.roles,
    activityEventId: row.activityEventId,
    revokedAt: row.revokedAt ? toIso(row.revokedAt) : null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function rowToClaimHistory(row: typeof nearcatalogClaimHistory.$inferSelect): CatalogClaimHistory {
  return {
    id: row.id,
    claimId: row.claimId,
    nearAccount: row.nearAccount,
    projectSlug: row.projectSlug,
    roles: row.roles,
    activityEventId: row.activityEventId,
    action: row.action,
    occurredAt: toIso(row.occurredAt),
  };
}

function normalizeRoles(roles: string[]): string[] {
  const normalized = new Map<string, string>();
  for (const role of roles) {
    const value = role.trim();
    const key = value.toLowerCase();
    if (value && !normalized.has(key)) normalized.set(key, value);
  }
  return Array.from(normalized.values());
}

function claimHistoryValues(
  claim: CatalogClaim,
  action: CatalogClaimHistoryAction,
  occurredAt: Date,
) {
  return {
    id: `claim-history:${claim.id}:${action}:${crypto.randomUUID()}`,
    claimId: claim.id,
    nearAccount: claim.nearAccount,
    projectSlug: claim.projectSlug,
    roles: claim.roles,
    activityEventId: claim.activityEventId,
    action,
    occurredAt,
  };
}

export function createClaimMethods(db: NearCatalogDatabase) {
  return {
    listClaims: (input: {
      nearAccount?: string;
      projectSlug?: string;
      limit?: number;
      cursor?: string;
    }) =>
      Effect.gen(function* () {
        const limit = Math.min(input.limit ?? 50, 100);
        const offset = input.cursor ? Math.max(Number.parseInt(input.cursor, 10) || 0, 0) : 0;
        const conditions = [
          isNull(nearcatalogClaims.revokedAt),
          isNotNull(nearcatalogClaims.activityEventId),
        ];
        if (input.nearAccount)
          conditions.push(
            eq(nearcatalogClaims.nearAccount, input.nearAccount.trim().toLowerCase()),
          );
        if (input.projectSlug)
          conditions.push(eq(nearcatalogClaims.projectSlug, input.projectSlug));
        const where = and(...conditions);

        const [counted, rows] = yield* Effect.promise(() =>
          Promise.all([
            db.select({ count: count() }).from(nearcatalogClaims).where(where),
            db
              .select()
              .from(nearcatalogClaims)
              .where(where)
              .orderBy(desc(nearcatalogClaims.createdAt), desc(nearcatalogClaims.id))
              .limit(limit)
              .offset(offset),
          ]),
        );
        const total = counted[0]?.count ?? 0;
        const nextOffset = offset + limit;
        const hasMore = nextOffset < total;

        return {
          data: rows.map(rowToClaim),
          meta: {
            total,
            hasMore,
            nextCursor: hasMore ? String(nextOffset) : null,
          },
        };
      }),

    listClaimsByProject: (nearAccount?: string) =>
      Effect.gen(function* () {
        const conditions = [
          isNull(nearcatalogClaims.revokedAt),
          isNotNull(nearcatalogClaims.activityEventId),
        ];
        if (nearAccount) {
          conditions.push(eq(nearcatalogClaims.nearAccount, nearAccount.trim().toLowerCase()));
        }
        const rows = yield* Effect.promise(() =>
          db
            .select()
            .from(nearcatalogClaims)
            .where(and(...conditions))
            .orderBy(nearcatalogClaims.projectSlug, nearcatalogClaims.nearAccount),
        );
        const grouped = new Map<string, CatalogClaim[]>();
        for (const row of rows) {
          const claims = grouped.get(row.projectSlug) ?? [];
          claims.push(rowToClaim(row));
          grouped.set(row.projectSlug, claims);
        }
        return grouped;
      }),

    getClaimHistory: (id: string) =>
      Effect.gen(function* () {
        const [claims, history] = yield* Effect.promise(() =>
          Promise.all([
            db
              .select({ id: nearcatalogClaims.id })
              .from(nearcatalogClaims)
              .where(eq(nearcatalogClaims.id, id)),
            db
              .select()
              .from(nearcatalogClaimHistory)
              .where(eq(nearcatalogClaimHistory.claimId, id))
              .orderBy(desc(nearcatalogClaimHistory.occurredAt), desc(nearcatalogClaimHistory.id)),
          ]),
        );
        if (!claims[0]) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Catalog claim not found" }),
          );
        }
        return history.map(rowToClaimHistory);
      }),

    applyClaim: (input: {
      nearAccount: string;
      projectSlug: string;
      roles: string[];
      activityEventId?: string;
    }) =>
      Effect.gen(function* () {
        const nearAccount = input.nearAccount.trim().toLowerCase();
        const roles = normalizeRoles(input.roles);
        if (roles.length === 0) {
          return yield* Effect.fail(
            new ORPCError("BAD_REQUEST", { message: "At least one role is required" }),
          );
        }
        const now = new Date();
        const saved = yield* Effect.promise(() =>
          db.transaction(async (tx) => {
            const [row] = await tx
              .insert(nearcatalogClaims)
              .values({
                id: catalogClaimId(nearAccount, input.projectSlug),
                nearAccount,
                projectSlug: input.projectSlug,
                roles,
                activityEventId: input.activityEventId ?? null,
                revokedAt: null,
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: [nearcatalogClaims.nearAccount, nearcatalogClaims.projectSlug],
                set: {
                  roles,
                  activityEventId:
                    input.activityEventId ??
                    sql<string | null>`case
                      when ${nearcatalogClaims.revokedAt} is null
                        then ${nearcatalogClaims.activityEventId}
                      else null
                    end`,
                  revokedAt: null,
                  updatedAt: now,
                },
              })
              .returning();
            if (!row) throw new Error("Could not apply Catalog claim");
            const claim = rowToClaim(row);
            await tx
              .insert(nearcatalogClaimHistory)
              .values(claimHistoryValues(claim, "applied", now));
            return claim;
          }),
        );
        return saved;
      }),

    setClaimActivity: (id: string, activityEventId: string) =>
      Effect.gen(function* () {
        const now = new Date();
        const updated = yield* Effect.promise(() =>
          db.transaction(async (tx) => {
            const [row] = await tx
              .update(nearcatalogClaims)
              .set({ activityEventId, updatedAt: now })
              .where(and(eq(nearcatalogClaims.id, id), isNull(nearcatalogClaims.revokedAt)))
              .returning();
            if (!row) return null;
            const claim = rowToClaim(row);
            await tx
              .insert(nearcatalogClaimHistory)
              .values(claimHistoryValues(claim, "activity-linked", now));
            return claim;
          }),
        );
        if (!updated) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Catalog claim not found" }),
          );
        }
        return updated;
      }),

    revokeClaim: (id: string) =>
      Effect.gen(function* () {
        const [existing] = yield* Effect.promise(() =>
          db.select().from(nearcatalogClaims).where(eq(nearcatalogClaims.id, id)).limit(1),
        );
        if (!existing) {
          return yield* Effect.fail(
            new ORPCError("NOT_FOUND", { message: "Catalog claim not found" }),
          );
        }
        if (existing.revokedAt) return rowToClaim(existing);
        const now = new Date();
        const updated = yield* Effect.promise(() =>
          db.transaction(async (tx) => {
            const [row] = await tx
              .update(nearcatalogClaims)
              .set({ revokedAt: now, updatedAt: now })
              .where(and(eq(nearcatalogClaims.id, id), isNull(nearcatalogClaims.revokedAt)))
              .returning();
            if (!row) return null;
            const claim = rowToClaim(row);
            await tx
              .insert(nearcatalogClaimHistory)
              .values(claimHistoryValues(claim, "revoked", now));
            return claim;
          }),
        );
        if (!updated) return rowToClaim(existing);
        return updated;
      }),
  };
}
