import { createHash, randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { type Database, DatabaseTag } from "../db/layer";
import { creditClaims, nearAiSessions } from "../db/schema";
import { createNearAiKeyClient, type NearAiKeyClient } from "./nearai-keys";

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export function parseEnabledFlag(value: string | undefined | null): boolean {
  return ENABLED_VALUES.has((value ?? "").trim().toLowerCase());
}

export type CreditsSecrets = {
  CREDITS_ENABLED: string;
  CREDITS_AMOUNT_USD: string;
  CREDITS_CLAIMS_CLOSE_AT: string;
  CREDITS_KEY_EXPIRES_AT: string;
  NEARAI_CREDITS_REFRESH_TOKEN: string;
  NEARAI_CREDITS_USER_AGENT: string;
  NEARAI_CREDITS_WORKSPACE_ID: string;
};

export type CreditsConfig = {
  enabled: boolean;
  amountCents: number;
  claimsCloseAt: Date | null;
  keyExpiresAt: Date | null;
  refreshToken: string;
  userAgent: string;
  workspaceId: string;
  problems: string[];
};

export type CreditEligibility = "eligible" | "needs_near_account" | "needs_approved_profile";

type CreditClaimRow = typeof creditClaims.$inferSelect;

const DEFAULT_AMOUNT_CENTS = 500;
const STALE_PENDING_MS = 2 * 60_000;

function parseDate(value: string, name: string, problems: string[]) {
  if (!value.trim()) {
    problems.push(`${name} is not set`);
    return null;
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    problems.push(`${name} is not a valid date`);
    return null;
  }
  return date;
}

function parseAmountCents(value: string, problems: string[]) {
  if (!value.trim()) return DEFAULT_AMOUNT_CENTS;
  const amount = Number(value.trim());
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || cents <= 0 || Math.abs(amount * 100 - cents) > 1e-6) {
    problems.push("CREDITS_AMOUNT_USD must be a positive dollar amount with at most two decimals");
    return DEFAULT_AMOUNT_CENTS;
  }
  return cents;
}

export function parseCreditsConfig(secrets: CreditsSecrets): CreditsConfig {
  const problems: string[] = [];
  const config = {
    enabled: parseEnabledFlag(secrets.CREDITS_ENABLED),
    amountCents: parseAmountCents(secrets.CREDITS_AMOUNT_USD, problems),
    claimsCloseAt: parseDate(secrets.CREDITS_CLAIMS_CLOSE_AT, "CREDITS_CLAIMS_CLOSE_AT", problems),
    keyExpiresAt: parseDate(secrets.CREDITS_KEY_EXPIRES_AT, "CREDITS_KEY_EXPIRES_AT", problems),
    refreshToken: secrets.NEARAI_CREDITS_REFRESH_TOKEN.trim(),
    userAgent: secrets.NEARAI_CREDITS_USER_AGENT.trim(),
    workspaceId: secrets.NEARAI_CREDITS_WORKSPACE_ID.trim(),
    problems,
  };
  if (!config.refreshToken) problems.push("NEARAI_CREDITS_REFRESH_TOKEN is not set");
  if (!config.userAgent) problems.push("NEARAI_CREDITS_USER_AGENT is not set");
  if (!config.workspaceId) problems.push("NEARAI_CREDITS_WORKSPACE_ID is not set");
  if (config.claimsCloseAt && config.keyExpiresAt && config.keyExpiresAt <= config.claimsCloseAt) {
    problems.push("CREDITS_KEY_EXPIRES_AT must be after CREDITS_CLAIMS_CLOSE_AT");
  }
  return config;
}

export function creditEligibility(
  nearAccountId: string | null | undefined,
  builderProfile: { withdrawnAt: string | null } | null,
): CreditEligibility {
  if (!nearAccountId) return "needs_near_account";
  if (!builderProfile || builderProfile.withdrawnAt) return "needs_approved_profile";
  return "eligible";
}

export function clientIp(headers: Headers | undefined) {
  return headers?.get("cf-connecting-ip")?.trim() || null;
}

function claimStatus(row: CreditClaimRow, now: Date): CreditClaimRow["status"] | "expired" {
  return row.status === "issued" && row.keyExpiresAt <= now ? "expired" : row.status;
}

function keyName(claimId: string) {
  return `nearbuilders-credit-${claimId}`;
}

function isUniqueViolation(error: unknown): boolean {
  for (let cause = error; cause; cause = (cause as { cause?: unknown }).cause) {
    if ((cause as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

function toClaim(row: CreditClaimRow, now: Date) {
  return {
    id: row.id,
    status: claimStatus(row, now),
    keyPrefix: row.keyPrefix,
    spendLimitUsd: row.spendLimitCents / 100,
    keyExpiresAt: row.keyExpiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdminClaim(row: CreditClaimRow, ipClaimCount: number, now: Date) {
  return {
    ...toClaim(row, now),
    nearAccountId: row.nearAccountId,
    userId: row.userId,
    ip: row.ip,
    ipClaimCount,
    error: row.error,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

function refreshTokenStore(db: Database, envRefreshToken: string) {
  const id = createHash("sha256").update(envRefreshToken).digest("hex");
  return {
    async load() {
      const [row] = await db
        .select({ refreshToken: nearAiSessions.refreshToken })
        .from(nearAiSessions)
        .where(eq(nearAiSessions.id, id));
      return row?.refreshToken ?? null;
    },
    async save(refreshToken: string) {
      await db
        .insert(nearAiSessions)
        .values({ id, refreshToken })
        .onConflictDoUpdate({
          target: nearAiSessions.id,
          set: { refreshToken, updatedAt: new Date() },
        });
    },
  };
}

function conflict(message: string) {
  return new ORPCError("CONFLICT", { message });
}

function unavailable() {
  return new ORPCError("SERVICE_UNAVAILABLE", {
    message: "API credits could not be issued right now. Try again in a few minutes.",
  });
}

export function createCreditMethods(
  db: Database,
  config: CreditsConfig,
  keys: NearAiKeyClient | null,
  now: () => Date = () => new Date(),
) {
  const claimWindow = () => {
    if (!config.enabled) return { open: false as const, reason: "Credit claims are not enabled" };
    if (config.problems.length > 0 || !config.keyExpiresAt || !keys) {
      return { open: false as const, reason: "Credit claims are not configured" };
    }
    const current = now();
    if (
      (config.claimsCloseAt && current >= config.claimsCloseAt) ||
      current >= config.keyExpiresAt
    ) {
      return { open: false as const, reason: "Credit claims are closed" };
    }
    return { open: true as const, keys, keyExpiresAt: config.keyExpiresAt };
  };

  const findClaim = async (nearAccountId: string) => {
    const [row] = await db
      .select()
      .from(creditClaims)
      .where(eq(creditClaims.nearAccountId, nearAccountId));
    return row ?? null;
  };

  const acquireClaim = async (input: {
    nearAccountId: string;
    userId: string;
    ip: string | null;
    keyExpiresAt: Date;
  }) => {
    const values = {
      userId: input.userId,
      ip: input.ip,
      status: "pending" as const,
      spendLimitCents: config.amountCents,
      keyExpiresAt: input.keyExpiresAt,
      error: null,
      updatedAt: now(),
    };
    const alreadyClaimed = conflict("API credits were already claimed for this account");
    try {
      const [inserted] = await db
        .insert(creditClaims)
        .values({ id: randomUUID(), nearAccountId: input.nearAccountId, ...values })
        .onConflictDoNothing()
        .returning();
      if (inserted) return { row: inserted, retry: false };

      const [retried] = await db
        .update(creditClaims)
        .set({ ...values, attempt: sql`${creditClaims.attempt} + 1` })
        .where(
          and(
            eq(creditClaims.nearAccountId, input.nearAccountId),
            or(
              eq(creditClaims.status, "failed"),
              and(
                eq(creditClaims.status, "pending"),
                lt(creditClaims.updatedAt, new Date(now().getTime() - STALE_PENDING_MS)),
              ),
            ),
          ),
        )
        .returning();
      if (retried) return { row: retried, retry: true };
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyClaimed;
      throw error;
    }

    const existing = await findClaim(input.nearAccountId);
    if (existing?.status === "pending") throw conflict("Your claim is already being processed");
    throw alreadyClaimed;
  };

  const finishClaim = async (
    claim: CreditClaimRow,
    values: Partial<typeof creditClaims.$inferInsert>,
  ) => {
    const [row] = await db
      .update(creditClaims)
      .set({ ...values, updatedAt: now() })
      .where(
        and(
          eq(creditClaims.id, claim.id),
          eq(creditClaims.status, "pending"),
          eq(creditClaims.attempt, claim.attempt),
        ),
      )
      .returning();
    return row ?? null;
  };

  const countClaimsFromIp = async (ip: string | null) => {
    if (!ip) return 0;
    const [result] = await db
      .select({ total: count() })
      .from(creditClaims)
      .where(eq(creditClaims.ip, ip));
    return result?.total ?? 0;
  };

  return {
    async getStatus(nearAccountId: string | null, eligibility: CreditEligibility) {
      const claim = nearAccountId ? await findClaim(nearAccountId) : null;
      return {
        available: claimWindow().open,
        amountUsd: config.amountCents / 100,
        claimsCloseAt: config.claimsCloseAt?.toISOString() ?? null,
        eligibility,
        claim: claim ? toClaim(claim, now()) : null,
      };
    },

    async claim(input: {
      nearAccountId: string;
      userId: string;
      ip: string | null;
      eligibility: CreditEligibility;
    }) {
      const state = claimWindow();
      if (!state.open) throw new ORPCError("FORBIDDEN", { message: state.reason });
      if (input.eligibility !== "eligible") {
        throw new ORPCError("FORBIDDEN", {
          message: "An approved builder profile is required to claim API credits",
        });
      }

      const { keys } = state;
      const { row, retry } = await acquireClaim({ ...input, keyExpiresAt: state.keyExpiresAt });
      const name = keyName(row.id);
      let created: Awaited<ReturnType<NearAiKeyClient["createKey"]>>;
      try {
        if (retry) {
          const orphan = await keys.findKeyByName(name);
          if (orphan?.isActive) await keys.revokeKey(orphan.id);
        }
        created = await keys.createKey({
          name,
          spendLimitCents: row.spendLimitCents,
          expiresAt: row.keyExpiresAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Credits] Credit claim failed:", row.id, message);
        await finishClaim(row, { status: "failed", error: message });
        throw unavailable();
      }

      const issued = await finishClaim(row, {
        status: "issued",
        keyId: created.id,
        keyPrefix: created.keyPrefix,
      }).catch((error: unknown) => {
        console.error("[Credits] Issued key could not be recorded:", row.id, error);
        throw unavailable();
      });
      if (!issued) {
        await keys.revokeKey(created.id).catch((error: unknown) => {
          console.error("[Credits] Superseded key could not be revoked:", created.id, error);
        });
        throw conflict("This claim changed while the key was being created. Check its status.");
      }
      return { key: created.key, claim: toClaim(issued, now()) };
    },

    async listClaims(input: { limit: number; offset: number }) {
      const [rows, [totals]] = await Promise.all([
        db
          .select()
          .from(creditClaims)
          .orderBy(desc(creditClaims.createdAt), desc(creditClaims.id))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ total: count() }).from(creditClaims),
      ]);
      const ips = [...new Set(rows.flatMap((row) => (row.ip ? [row.ip] : [])))];
      const ipCounts =
        ips.length > 0
          ? await db
              .select({ ip: creditClaims.ip, total: count() })
              .from(creditClaims)
              .where(inArray(creditClaims.ip, ips))
              .groupBy(creditClaims.ip)
          : [];
      const countByIp = new Map(ipCounts.map((entry) => [entry.ip, entry.total]));
      const total = totals?.total ?? 0;
      const nextOffset = input.offset + rows.length;
      return {
        data: rows.map((row) =>
          toAdminClaim(row, row.ip ? (countByIp.get(row.ip) ?? 1) : 0, now()),
        ),
        meta: {
          total,
          hasMore: nextOffset < total,
          nextCursor: nextOffset < total ? String(nextOffset) : null,
        },
      };
    },

    async revokeClaim(id: string) {
      const [row] = await db.select().from(creditClaims).where(eq(creditClaims.id, id));
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Credit claim not found" });
      if (!keys) {
        if (row.status === "revoked") {
          return { data: toAdminClaim(row, await countClaimsFromIp(row.ip), now()) };
        }
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message: "NEAR AI credentials are not configured",
        });
      }
      const [revoked] =
        row.status === "revoked"
          ? [row]
          : await db
              .update(creditClaims)
              .set({ status: "revoked", revokedAt: now(), updatedAt: now() })
              .where(eq(creditClaims.id, row.id))
              .returning();
      if (row.keyId) {
        await keys.revokeKey(row.keyId);
      } else {
        const orphan = await keys.findKeyByName(keyName(row.id));
        if (orphan?.isActive) await keys.revokeKey(orphan.id);
      }
      return { data: toAdminClaim(revoked!, await countClaimsFromIp(row.ip), now()) };
    },
  };
}

type CreditMethods = ReturnType<typeof createCreditMethods>;

export class CreditService extends Context.Service<CreditService, CreditMethods>()(
  "credits/CreditService",
) {}

export const CreditServiceLive = (config: CreditsConfig) =>
  Layer.effect(
    CreditService,
    Effect.gen(function* () {
      const db = yield* DatabaseTag;
      const keys =
        config.refreshToken && config.userAgent && config.workspaceId
          ? createNearAiKeyClient({
              refreshToken: config.refreshToken,
              userAgent: config.userAgent,
              workspaceId: config.workspaceId,
              store: refreshTokenStore(db, config.refreshToken),
            })
          : null;
      return createCreditMethods(db, config, keys);
    }),
  );
