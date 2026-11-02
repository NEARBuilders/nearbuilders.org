import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Who the caller is, for rows they own: their NEAR accounts (primary first, then linked)
 * and their auth user id. New rows are keyed on the primary account (#329); the user id is
 * kept only to find rows written before rows carried an account.
 */
export type Owner = {
  userId: string;
  accounts: string[];
};

export function ownerFromContext(context: {
  userId?: string | null;
  near?: {
    primaryAccountId?: string | null;
    linkedAccounts?: Array<{ accountId?: string | null }> | null;
  } | null;
}): Owner {
  const accounts: string[] = [];
  const add = (id: string | null | undefined) => {
    const normalized = id?.trim().toLowerCase();
    if (normalized && !accounts.includes(normalized)) accounts.push(normalized);
  };
  add(context.near?.primaryAccountId);
  for (const account of context.near?.linkedAccounts ?? []) add(account.accountId);
  return { userId: context.userId ?? "", accounts };
}

/** Rows owned by the caller: any of their accounts, or a legacy row with only their user id. */
export function ownedBy(columns: { nearAccount: PgColumn; userId: PgColumn }, owner: Owner): SQL {
  const legacy = and(isNull(columns.nearAccount), eq(columns.userId, owner.userId));
  return owner.accounts.length > 0
    ? (or(inArray(columns.nearAccount, owner.accounts), legacy) as SQL)
    : (legacy as SQL);
}
