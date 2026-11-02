import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import type { z } from "zod";
import type { CreditEligibilitySchema } from "../contract";
import { type Database, DatabaseTag } from "../db/layer";
import { creditClaims } from "../db/schema";
import {
  createNearAiKeyClient,
  createNearAiLoginClient,
  type NearAiKeyClient,
  type NearAiLoginClient,
  type NearAiLoginPayload,
  type NearAiRefreshTokenStore,
  NearAiRequestError,
  type NearAiSignedMessage,
  signatureToBase64,
} from "./nearai-keys";
import { createNearAiReportingClient, type NearAiReportingClient } from "./nearai-usage";
import {
  readReporting,
  readSessionExpiry,
  readSessionToken,
  readSettings,
  type SettingsInput,
  type SettingsRow,
  settingsToDto,
  validateAmountCents,
  validateSettings,
  writeReporting,
  writeSession,
  writeSettings,
} from "./settings";

export type CreditEligibility = z.infer<typeof CreditEligibilitySchema>;

export function creditEligibility(
  nearAccountId: string | null | undefined,
  builderProfile: { withdrawnAt: string | null } | null,
): CreditEligibility {
  if (!nearAccountId) return "needs_near_account";
  if (!builderProfile) return "needs_approved_profile";
  if (builderProfile.withdrawnAt) return "needs_profile_restore";
  return "eligible";
}

export function clientIp(headers: Headers | undefined) {
  return headers?.get("cf-connecting-ip")?.trim() || null;
}

function refreshTokenStore(db: Database) {
  return {
    async load() {
      return readSessionToken(db);
    },
    async save(refreshToken: string, expiresAt: Date | null) {
      await writeSession(db, refreshToken, expiresAt);
    },
  };
}

type CreditClaimRow = typeof creditClaims.$inferSelect;

const STALE_PENDING_MS = 2 * 60_000;

type ClaimWindow =
  | { open: false; reason: string; statusReason: "not_enabled" | "not_configured" | "closed" }
  | {
      open: true;
      keys: NearAiKeyClient;
      keyExpiresAt: Date | null;
      amountCents: number;
    };

type WindowState = { row: SettingsRow | null; window: ClaimWindow };

function toIso(date: Date | null) {
  return date?.toISOString() ?? null;
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
  keys: NearAiKeyClient,
  login: NearAiLoginClient,
  store: NearAiRefreshTokenStore,
  reporting: NearAiReportingClient,
  now: () => Date = () => new Date(),
) {
  const currentWindow = async (): Promise<WindowState> => {
    const row = await readSettings(db);
    if (!row?.enabled) {
      return {
        row,
        window: {
          open: false,
          statusReason: row ? "not_enabled" : "not_configured",
          reason: !row ? "Credit claims are not configured" : "Credit claims are not enabled",
        },
      };
    }
    const amount = validateAmountCents(Number(row.amountUsd));
    const workspaceId = row.nearAiWorkspaceId.trim();
    if (!workspaceId || !amount.ok) {
      return {
        row,
        window: {
          open: false,
          statusReason: "not_configured",
          reason: "Credit claims are not configured",
        },
      };
    }
    const current = now();
    if (
      (row.claimsCloseAt && current >= row.claimsCloseAt) ||
      (row.keyExpiresAt && current >= row.keyExpiresAt)
    ) {
      return {
        row,
        window: { open: false, statusReason: "closed", reason: "Credit claims are closed" },
      };
    }
    return {
      row,
      window: { open: true, keys, keyExpiresAt: row.keyExpiresAt, amountCents: amount.cents },
    };
  };

  /**
   * The caller's claim: one made under any of their NEAR accounts (primary first, then linked,
   * #365) or with their user id. Preferring the account order keeps the result stable when a
   * reissued user id and an old linked account point at different rows.
   */
  const findClaim = async (input: { nearAccountIds: readonly string[]; userId: string }) => {
    const accounts = input.nearAccountIds.filter(Boolean);
    const conditions = [eq(creditClaims.userId, input.userId)];
    if (accounts.length > 0) conditions.push(inArray(creditClaims.nearAccountId, [...accounts]));
    const rows = await db
      .select()
      .from(creditClaims)
      .where(or(...conditions));
    for (const account of accounts) {
      const match = rows.find((row) => row.nearAccountId === account);
      if (match) return match;
    }
    return rows[0] ?? null;
  };

  const acquireClaim = async (input: {
    nearAccountId: string;
    linkedAccountIds?: readonly string[];
    userId: string;
    ip: string | null;
    amountCents: number;
    keyExpiresAt: Date | null;
  }) => {
    const values = {
      userId: input.userId,
      ip: input.ip,
      status: "pending" as const,
      spendLimitCents: input.amountCents,
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

    const existing = await findClaim({
      nearAccountIds: [input.nearAccountId, ...(input.linkedAccountIds ?? [])],
      userId: input.userId,
    });
    if (existing?.status === "pending") throw conflict("Your claim is already being processed");
    if (existing && existing.nearAccountId !== input.nearAccountId) {
      throw conflict(`Credits were already claimed with ${existing.nearAccountId}`);
    }
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

  async function revokeWithKeys(run: (client: NearAiKeyClient) => Promise<void>) {
    try {
      await run(keys);
    } catch (error) {
      if (error instanceof NearAiRequestError) {
        throw new ORPCError("SERVICE_UNAVAILABLE", {
          message:
            "NEAR AI credentials could not process this revocation. Try again in a few minutes.",
        });
      }
      throw error;
    }
  }

  return {
    async getSettings() {
      const row = await readSettings(db);
      return { settings: row ? settingsToDto(row) : null };
    },

    async updateSettings(input: SettingsInput, updatedBy: string) {
      const result = validateSettings(input);
      if (!result.ok) {
        throw new ORPCError("BAD_REQUEST", {
          message: result.problems.join("; "),
          data: { invalidFields: result.invalidFields },
        });
      }
      const row = await writeSettings(db, result.values, updatedBy, now());
      return { settings: settingsToDto(row) };
    },

    async getStatus(
      nearAccountIds: readonly string[],
      userId: string,
      eligibility: CreditEligibility,
    ) {
      const { row, window } = await currentWindow();
      const claim = await findClaim({ nearAccountIds, userId });
      return {
        available: window.open,
        statusReason: window.open ? null : window.statusReason,
        amountUsd: row ? Number(row.amountUsd) : 0,
        claimsCloseAt: row?.claimsCloseAt?.toISOString() ?? null,
        eligibility,
        claim: claim ? toClaim(claim, now()) : null,
      };
    },

    async nearAiSessionStatus() {
      const refreshExpiresAt = await readSessionExpiry(db);
      const reportingCredentials = await readReporting(db);
      const usageReporting = Boolean(
        reportingCredentials.orgId && reportingCredentials.reportingToken,
      );
      try {
        await keys.verifySession();
        return {
          status: "valid" as const,
          refreshExpiresAt: toIso(refreshExpiresAt),
          usageReporting,
        };
      } catch (error) {
        if (error instanceof NearAiRequestError && error.status === 401) {
          return {
            status: error.message.includes("not signed in")
              ? ("absent" as const)
              : ("expired" as const),
            refreshExpiresAt: toIso(refreshExpiresAt),
            usageReporting,
          };
        }
        if (error instanceof NearAiRequestError) {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "NEAR AI could not be reached. Try again in a few minutes.",
          });
        }
        throw error;
      }
    },

    async loginNearAi(input: { signedMessage: NearAiSignedMessage; payload: NearAiLoginPayload }) {
      const settings = await readSettings(db);
      const guardAccount = settings?.nearAiLoginAccountId.trim();
      if (!guardAccount) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Set the NEAR AI login account in credits settings first",
        });
      }
      if (input.signedMessage.accountId.toLowerCase() !== guardAccount.toLowerCase()) {
        throw new ORPCError("FORBIDDEN", {
          message: `Only ${guardAccount} can sign in the NEAR AI credentials`,
        });
      }
      try {
        const { refreshToken, refreshExpiresAt } = await login.login({
          signedMessage: {
            ...input.signedMessage,
            signature: signatureToBase64(input.signedMessage.signature),
          },
          payload: input.payload,
        });
        await store.save(refreshToken, refreshExpiresAt);
        keys.resetSession();
        const provisioned = await reporting.provision();
        if (provisioned) {
          await writeReporting(db, provisioned).catch((error: unknown) => {
            console.warn("[Credits] Reporting credentials could not be stored:", error);
          });
        }
        return {
          status: "valid" as const,
          refreshExpiresAt: toIso(refreshExpiresAt),
          usageReporting: Boolean(provisioned),
        };
      } catch (error) {
        if (error instanceof NearAiRequestError) {
          throw new ORPCError(error.status >= 500 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST", {
            message: error.message,
          });
        }
        throw error;
      }
    },

    async claim(input: {
      nearAccountId: string;
      linkedAccountIds?: readonly string[];
      userId: string;
      ip: string | null;
      eligibility: CreditEligibility;
    }) {
      const { window } = await currentWindow();
      // One claim per person: a claim under another of their linked accounts counts (#365).
      const prior = await findClaim({
        nearAccountIds: [input.nearAccountId, ...(input.linkedAccountIds ?? [])],
        userId: input.userId,
      });
      if (prior && prior.nearAccountId !== input.nearAccountId) {
        throw conflict(`Credits were already claimed with ${prior.nearAccountId}`);
      }
      if (!window.open) throw new ORPCError("FORBIDDEN", { message: window.reason });
      if (input.eligibility !== "eligible") {
        throw new ORPCError("FORBIDDEN", {
          message: "An approved builder profile is required to claim API credits",
        });
      }

      const { row, retry } = await acquireClaim({
        ...input,
        amountCents: window.amountCents,
        keyExpiresAt: window.keyExpiresAt,
      });
      const name = keyName(input.nearAccountId, row.id);
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

    async getUsage(input: { nearAccountIds: readonly string[]; userId: string }) {
      const claim = await findClaim({ nearAccountIds: input.nearAccountIds, userId: input.userId });
      if (!claim?.keyId) return { usage: null };
      const status = claimStatus(claim, now());
      if (status !== "issued" && status !== "expired") return { usage: null };
      const used = await reporting.getKeyUsage({
        apiKeyId: claim.keyId,
        startTime: claim.createdAt,
      });
      if (!used) return { usage: null };
      return {
        usage: {
          usedUsd: nanoUsdToUsd(used.usedNanoUsd),
          spendLimitUsd: claim.spendLimitCents / 100,
          keyExpiresAt: claim.keyExpiresAt?.toISOString() ?? null,
        },
      };
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
      const usedByKey = rows.some((row) => row.keyId)
        ? ((await reporting.getOrganizationUsage())?.usedNanoUsdByKeyId ?? null)
        : null;
      const total = totals?.total ?? 0;
      const nextOffset = input.offset + rows.length;
      return {
        data: rows.map((row) =>
          toAdminClaim(
            row,
            row.ip ? (countByIp.get(row.ip) ?? 1) : 0,
            now(),
            row.keyId ? (usedByKey?.get(row.keyId) ?? null) : null,
          ),
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
      const [revoked] =
        row.status === "revoked"
          ? [row]
          : await db
              .update(creditClaims)
              .set({ status: "revoked", revokedAt: now(), updatedAt: now() })
              .where(eq(creditClaims.id, row.id))
              .returning();
      if (row.keyId) {
        await revokeWithKeys((client) => client.revokeKey(row.keyId!));
      } else {
        await revokeWithKeys(async (client) => {
          const orphan = await client.findKeyByName(keyName(row.nearAccountId, row.id));
          if (orphan?.isActive) await client.revokeKey(orphan.id);
        });
      }
      return { data: toAdminClaim(revoked!, await countClaimsFromIp(row.ip), now(), null) };
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  for (let cause = error; cause; cause = (cause as { cause?: unknown }).cause) {
    if ((cause as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

function keyName(nearAccountId: string, claimId: string) {
  return `${nearAccountId}-nearbuilders-credit-${claimId}`;
}

function claimStatus(row: CreditClaimRow, now: Date): CreditClaimRow["status"] | "expired" {
  return row.status === "issued" && row.keyExpiresAt && row.keyExpiresAt <= now
    ? "expired"
    : row.status;
}

function toClaim(row: CreditClaimRow, now: Date) {
  return {
    id: row.id,
    status: claimStatus(row, now),
    nearAccountId: row.nearAccountId,
    keyPrefix: row.keyPrefix,
    spendLimitUsd: row.spendLimitCents / 100,
    keyExpiresAt: row.keyExpiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdminClaim(
  row: CreditClaimRow,
  ipClaimCount: number,
  now: Date,
  usedNanoUsd: number | null,
) {
  return {
    ...toClaim(row, now),
    nearAccountId: row.nearAccountId,
    userId: row.userId,
    ip: row.ip,
    ipClaimCount,
    error: row.error,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    usedUsd: usedNanoUsd === null ? null : nanoUsdToUsd(usedNanoUsd),
  };
}

function nanoUsdToUsd(nanoUsd: number) {
  return Math.round(nanoUsd / 1e5) / 1e4;
}

type CreditMethods = ReturnType<typeof createCreditMethods>;

export class CreditService extends Context.Service<CreditService, CreditMethods>()(
  "credits/CreditService",
) {}

export const CreditServiceLive = () =>
  Layer.effect(
    CreditService,
    Effect.gen(function* () {
      const db = yield* DatabaseTag;
      const store = refreshTokenStore(db);
      const keys = createNearAiKeyClient({
        store,
        workspaceId: async () => (await readSettings(db))?.nearAiWorkspaceId ?? "",
      });
      const login = createNearAiLoginClient({});
      const reporting = createNearAiReportingClient({
        store,
        loadExpiresAt: () => readSessionExpiry(db),
        readReporting: async () => {
          const [stored, settingsRow] = await Promise.all([readReporting(db), readSettings(db)]);
          return {
            orgId: settingsRow?.nearAiOrgId.trim() || stored.orgId,
            reportingToken: stored.reportingToken,
          };
        },
      });
      return createCreditMethods(db, keys, login, store, reporting);
    }),
  );
