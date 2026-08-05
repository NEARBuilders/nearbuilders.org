import { and, count, desc, eq, isNull, lte } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type { IssueClaimSchema } from "../contract";
import type { Database } from "../db";
import { DatabaseTag } from "../db/layer";
import { issueClaims } from "../db/schema";

export type IssueClaim = z.infer<typeof IssueClaimSchema>;
export type IssueClaimStatus = IssueClaim["status"];

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function claimId(repoOwner: string, repoName: string, issueNumber: number, now: Date) {
  return `${repoOwner}/${repoName}#${issueNumber}@${now.toISOString()}:${crypto.randomUUID().slice(0, 8)}`;
}

function computeStatus(row: typeof issueClaims.$inferSelect, now: Date): IssueClaimStatus {
  if (row.releasedAt) return "released";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  if (row.prState === "merged") return "merged";
  if (row.prUrl) return "submitted";
  return "active";
}

function rowToClaim(row: typeof issueClaims.$inferSelect, now = new Date()): IssueClaim {
  return {
    id: row.id,
    repoOwner: row.repoOwner,
    repoName: row.repoName,
    issueNumber: row.issueNumber,
    issueTitle: row.issueTitle,
    issueUrl: row.issueUrl,
    nearAccount: row.nearAccount,
    claimedAt: toIso(row.claimedAt),
    expiresAt: toIso(row.expiresAt),
    releasedAt: row.releasedAt ? toIso(row.releasedAt) : null,
    prUrl: row.prUrl ?? null,
    status: computeStatus(row, now),
  };
}

export interface ClaimMethodsConfig {
  ttlMs?: number;
}

export function createClaimMethods(db: Database, config: ClaimMethodsConfig = {}) {
  const ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;

  return {
    listClaims: (input: {
      nearAccount?: string;
      active?: boolean;
      limit?: number;
      cursor?: string;
    }) =>
      Effect.gen(function* () {
        const now = new Date();
        const limit = Math.min(input.limit ?? 25, 100);
        const offset = input.cursor ? Math.max(Number.parseInt(input.cursor, 10) || 0, 0) : 0;

        const conditions = [];
        if (input.nearAccount) {
          conditions.push(eq(issueClaims.nearAccount, input.nearAccount.trim().toLowerCase()));
        }
        if (input.active) {
          conditions.push(isNull(issueClaims.releasedAt));
        }
        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const [counted, rows] = yield* Effect.promise(() =>
          Promise.all([
            where
              ? db.select({ count: count() }).from(issueClaims).where(where)
              : db.select({ count: count() }).from(issueClaims),
            (where ? db.select().from(issueClaims).where(where) : db.select().from(issueClaims))
              .orderBy(desc(issueClaims.claimedAt), desc(issueClaims.id))
              .limit(limit)
              .offset(offset),
          ]),
        );
        const total = counted[0]?.count ?? 0;
        const nextOffset = offset + limit;
        const hasMore = nextOffset < total;

        let data = rows.map((row) => rowToClaim(row, now));
        if (input.active) {
          data = data.filter((claim) => claim.status !== "expired" && claim.status !== "released");
        }

        return {
          data,
          meta: {
            total,
            hasMore,
            nextCursor: hasMore ? String(nextOffset) : null,
          },
        };
      }),

    getActiveClaimsForIssues: (repoOwner: string, repoName: string, issueNumbers: number[]) =>
      Effect.gen(function* () {
        if (issueNumbers.length === 0) return new Map<number, IssueClaim>();
        const now = new Date();
        const rows = yield* Effect.promise(() =>
          db
            .select()
            .from(issueClaims)
            .where(
              and(
                eq(issueClaims.repoOwner, repoOwner),
                eq(issueClaims.repoName, repoName),
                isNull(issueClaims.releasedAt),
              ),
            ),
        );
        const wanted = new Set(issueNumbers);
        const map = new Map<number, IssueClaim>();
        for (const row of rows) {
          if (!wanted.has(row.issueNumber)) continue;
          const claim = rowToClaim(row, now);
          if (claim.status === "expired") continue;
          map.set(row.issueNumber, claim);
        }
        return map;
      }),

    getActiveClaimForIssue: (repoOwner: string, repoName: string, issueNumber: number) =>
      Effect.gen(function* () {
        const now = new Date();
        const [row] = yield* Effect.promise(() =>
          db
            .select()
            .from(issueClaims)
            .where(
              and(
                eq(issueClaims.repoOwner, repoOwner),
                eq(issueClaims.repoName, repoName),
                eq(issueClaims.issueNumber, issueNumber),
                isNull(issueClaims.releasedAt),
              ),
            )
            .limit(1),
        );
        if (!row) return null;
        const claim = rowToClaim(row, now);
        if (claim.status === "expired") return null;
        return claim;
      }),

    claimIssue: (input: {
      repoOwner: string;
      repoName: string;
      issueNumber: number;
      issueTitle: string;
      issueUrl: string;
      nearAccount: string;
    }) =>
      Effect.gen(function* () {
        const now = new Date();
        const account = input.nearAccount.trim().toLowerCase();

        const [existing] = yield* Effect.promise(() =>
          db
            .select()
            .from(issueClaims)
            .where(
              and(
                eq(issueClaims.repoOwner, input.repoOwner),
                eq(issueClaims.repoName, input.repoName),
                eq(issueClaims.issueNumber, input.issueNumber),
                isNull(issueClaims.releasedAt),
              ),
            )
            .limit(1),
        );

        if (existing) {
          const existingClaim = rowToClaim(existing, now);
          if (existingClaim.status !== "expired") {
            if (existing.nearAccount === account) {
              const extended = yield* Effect.promise(() =>
                db
                  .update(issueClaims)
                  .set({ expiresAt: new Date(now.getTime() + ttlMs) })
                  .where(eq(issueClaims.id, existing.id))
                  .returning(),
              );
              const [row] = extended;
              if (!row) throw new Error("Failed to extend claim");
              return rowToClaim(row, now);
            }
            return yield* Effect.fail(
              new ORPCError("FORBIDDEN", {
                message: "Issue is already claimed by another builder",
                data: { claimedBy: existing.nearAccount },
              }),
            );
          }
          yield* Effect.promise(() =>
            db.update(issueClaims).set({ releasedAt: now }).where(eq(issueClaims.id, existing.id)),
          );
        }

        const inserted = yield* Effect.promise(() =>
          db
            .insert(issueClaims)
            .values({
              id: claimId(input.repoOwner, input.repoName, input.issueNumber, now),
              repoOwner: input.repoOwner,
              repoName: input.repoName,
              issueNumber: input.issueNumber,
              issueTitle: input.issueTitle,
              issueUrl: input.issueUrl,
              nearAccount: account,
              claimedAt: now,
              expiresAt: new Date(now.getTime() + ttlMs),
              releasedAt: null,
              prUrl: null,
              prState: null,
              prCheckedAt: null,
            })
            .returning(),
        );
        const [row] = inserted;
        if (!row) throw new Error("Failed to create claim");
        return rowToClaim(row, now);
      }),

    releaseClaim: (id: string, nearAccount: string, isAdmin: boolean) =>
      Effect.gen(function* () {
        const [existing] = yield* Effect.promise(() =>
          db.select().from(issueClaims).where(eq(issueClaims.id, id)).limit(1),
        );
        if (!existing) {
          return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Claim not found" }));
        }
        if (!isAdmin && existing.nearAccount !== nearAccount.trim().toLowerCase()) {
          return yield* Effect.fail(
            new ORPCError("FORBIDDEN", {
              message: "You can only release claims you own",
            }),
          );
        }
        if (existing.releasedAt) return rowToClaim(existing);
        const now = new Date();
        const [updated] = yield* Effect.promise(() =>
          db.update(issueClaims).set({ releasedAt: now }).where(eq(issueClaims.id, id)).returning(),
        );
        if (!updated) return rowToClaim(existing);
        return rowToClaim(updated, now);
      }),

    attachPr: (
      id: string,
      prUrl: string,
      nearAccount: string,
      isAdmin: boolean,
      prState?: "open" | "merged" | "closed",
    ) =>
      Effect.gen(function* () {
        const [existing] = yield* Effect.promise(() =>
          db.select().from(issueClaims).where(eq(issueClaims.id, id)).limit(1),
        );
        if (!existing) {
          return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Claim not found" }));
        }
        if (!isAdmin && existing.nearAccount !== nearAccount.trim().toLowerCase()) {
          return yield* Effect.fail(
            new ORPCError("FORBIDDEN", {
              message: "You can only attach a PR to your own claim",
            }),
          );
        }
        const now = new Date();
        const [updated] = yield* Effect.promise(() =>
          db
            .update(issueClaims)
            .set({
              prUrl,
              prState: prState ?? existing.prState ?? "open",
              prCheckedAt: now,
            })
            .where(eq(issueClaims.id, id))
            .returning(),
        );
        if (!updated) throw new Error("Failed to attach PR");
        return rowToClaim(updated, now);
      }),

    sweepExpired: () =>
      Effect.gen(function* () {
        const now = new Date();
        const swept = yield* Effect.promise(() =>
          db
            .update(issueClaims)
            .set({ releasedAt: now })
            .where(and(isNull(issueClaims.releasedAt), lte(issueClaims.expiresAt, now)))
            .returning({ id: issueClaims.id }),
        );
        return swept.length;
      }),
  };
}

type ClaimMethods = ReturnType<typeof createClaimMethods>;

export class ClaimService extends Context.Tag("issues/ClaimService")<
  ClaimService,
  ClaimMethods
>() {}

export const ClaimServiceLive = (config: ClaimMethodsConfig = {}) =>
  Layer.effect(
    ClaimService,
    Effect.gen(function* () {
      const db = yield* DatabaseTag;
      return createClaimMethods(db, config);
    }),
  );
