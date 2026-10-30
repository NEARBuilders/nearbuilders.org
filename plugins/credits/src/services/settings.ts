import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { CreditSettingsInputSchema, CreditSettingsSchema } from "../contract";
import type { Database } from "../db/layer";
import { creditSettings, nearAiSessions } from "../db/schema";

export const SETTINGS_ID = "global";

export type SettingsRow = typeof creditSettings.$inferSelect;

export type SettingsInput = z.infer<typeof CreditSettingsInputSchema>;

export type SettingsDto = z.infer<typeof CreditSettingsSchema>;

export type SettingsValues = {
  enabled: boolean;
  amountCents: number;
  claimsCloseAt: Date | null;
  keyExpiresAt: Date | null;
  nearAiWorkspaceId: string;
  nearAiLoginAccountId: string;
};

const MAX_AMOUNT_CENTS = 9_999_999_999;

export function validateAmountCents(
  amountUsd: number,
): { ok: true; cents: number } | { ok: false } {
  const cents = Math.round(amountUsd * 100);
  if (
    !Number.isFinite(amountUsd) ||
    cents <= 0 ||
    cents > MAX_AMOUNT_CENTS ||
    Math.abs(amountUsd * 100 - cents) > 1e-6
  ) {
    return { ok: false };
  }
  return { ok: true, cents };
}

function parseDate(value: string | null): Date | null | { invalid: true } {
  if (value == null || !value.trim()) return null;
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) return { invalid: true };
  return date;
}

export function validateSettings(input: SettingsInput):
  | {
      ok: true;
      values: SettingsValues;
    }
  | {
      ok: false;
      problems: string[];
      invalidFields: string[];
    } {
  const problems: string[] = [];
  const invalidFields: string[] = [];

  const amount = validateAmountCents(input.amountUsd);
  if (!amount.ok) {
    problems.push("Amount must be a positive dollar amount with at most two decimals");
    invalidFields.push("amountUsd");
  }

  const claimsCloseAt = parseDate(input.claimsCloseAt);
  if (claimsCloseAt && "invalid" in claimsCloseAt) {
    problems.push("Claims close date is not a valid date");
    invalidFields.push("claimsCloseAt");
  }

  const keyExpiresAt = parseDate(input.keyExpiresAt);
  if (keyExpiresAt && "invalid" in keyExpiresAt) {
    problems.push("Key expiry date is not a valid date");
    invalidFields.push("keyExpiresAt");
  }

  if (
    claimsCloseAt &&
    keyExpiresAt &&
    !("invalid" in claimsCloseAt) &&
    !("invalid" in keyExpiresAt) &&
    keyExpiresAt.getTime() <= claimsCloseAt.getTime()
  ) {
    problems.push("Key expiry must be after claims close");
    invalidFields.push("keyExpiresAt");
  }

  if (problems.length > 0) return { ok: false, problems, invalidFields };

  return {
    ok: true,
    values: {
      enabled: input.enabled,
      amountCents: amount.ok ? amount.cents : 0,
      claimsCloseAt: claimsCloseAt && !("invalid" in claimsCloseAt) ? claimsCloseAt : null,
      keyExpiresAt: keyExpiresAt && !("invalid" in keyExpiresAt) ? keyExpiresAt : null,
      nearAiWorkspaceId: input.nearAiWorkspaceId.trim(),
      nearAiLoginAccountId: input.nearAiLoginAccountId.trim(),
    },
  };
}

export async function readSettings(db: Database): Promise<SettingsRow | null> {
  const [row] = await db.select().from(creditSettings).where(eq(creditSettings.id, SETTINGS_ID));
  return row ?? null;
}

export async function writeSettings(
  db: Database,
  values: SettingsValues,
  updatedBy: string,
  updatedAt: Date,
): Promise<SettingsRow> {
  const [row] = await db
    .insert(creditSettings)
    .values({
      id: SETTINGS_ID,
      enabled: values.enabled,
      amountUsd: (values.amountCents / 100).toFixed(2),
      claimsCloseAt: values.claimsCloseAt,
      keyExpiresAt: values.keyExpiresAt,
      nearAiWorkspaceId: values.nearAiWorkspaceId,
      nearAiLoginAccountId: values.nearAiLoginAccountId,
      updatedBy,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: creditSettings.id,
      set: {
        enabled: values.enabled,
        amountUsd: (values.amountCents / 100).toFixed(2),
        claimsCloseAt: values.claimsCloseAt,
        keyExpiresAt: values.keyExpiresAt,
        nearAiWorkspaceId: values.nearAiWorkspaceId,
        nearAiLoginAccountId: values.nearAiLoginAccountId,
        updatedBy,
        updatedAt,
      },
    })
    .returning();
  return row!;
}

export function settingsToDto(row: SettingsRow): SettingsDto {
  return {
    enabled: row.enabled,
    amountUsd: Number(row.amountUsd),
    claimsCloseAt: row.claimsCloseAt?.toISOString() ?? null,
    keyExpiresAt: row.keyExpiresAt?.toISOString() ?? null,
    nearAiWorkspaceId: row.nearAiWorkspaceId,
    nearAiLoginAccountId: row.nearAiLoginAccountId,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function readSessionToken(db: Database): Promise<string | null> {
  const [row] = await db
    .select({ refreshToken: nearAiSessions.refreshToken })
    .from(nearAiSessions)
    .where(eq(nearAiSessions.id, nearAiSessionsPrimaryId()));
  return row?.refreshToken ?? null;
}

export async function readSessionExpiry(db: Database): Promise<Date | null> {
  const [row] = await db
    .select({ refreshExpiresAt: nearAiSessions.refreshExpiresAt })
    .from(nearAiSessions)
    .where(eq(nearAiSessions.id, nearAiSessionsPrimaryId()));
  return row?.refreshExpiresAt ?? null;
}

export async function writeSession(
  db: Database,
  refreshToken: string,
  refreshExpiresAt: Date | null,
): Promise<void> {
  await db
    .insert(nearAiSessions)
    .values({ id: nearAiSessionsPrimaryId(), refreshToken, refreshExpiresAt })
    .onConflictDoUpdate({
      target: nearAiSessions.id,
      set: { refreshToken, refreshExpiresAt, updatedAt: new Date() },
    });
}

function nearAiSessionsPrimaryId() {
  return "primary";
}
