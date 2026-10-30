import "dotenv/config";
import { Client } from "pg";
import {
  buildAuditReport,
  type ClaimRow,
  type NearLink,
  type ProfileRow,
} from "../src/services/eligibility-audit";

const usage = () => {
  console.log(`Audit users whose credits eligibility says needs_approved_profile while an
approved builder profile exists under a linked NEAR account.

Usage (from plugins/credits, with pnpm available):
  AUTH_DATABASE_URL=postgres://... \\
  BUILDERS_DATABASE_URL=postgres://... \\
  [CREDITS_DATABASE_URL=postgres://...] \\
  pnpm audit:eligibility [--json]

All connections are read-only. --flagging only; pair users with a case-by-case fix.`);
};

type ColumnKey = "userId" | "accountId" | "isPrimary";

function parseArgs(argv: string[]) {
  return {
    json: argv.includes("--json"),
  };
}

async function openDatabase(
  _name: string,
  url: string | undefined,
  readOnly: boolean,
): Promise<Client | null> {
  if (!url) return null;
  const client = new Client({ connectionString: url });
  await client.connect();
  if (readOnly) await client.query("SET default_transaction_read_only = on");
  return client;
}

async function discoverLinkTable(
  client: Client,
): Promise<{ table: string; columns: Record<ColumnKey, string> } | null> {
  const tables = await client.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  const table = tables.rows
    .map((row) => row.table_name)
    .find((name) => /near_?accounts?/i.test(name));
  if (!table) return null;

  const columns = await client.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [table],
  );
  const mapping: Partial<Record<ColumnKey, string>> = {};
  for (const { column_name } of columns.rows) {
    const normalized = column_name.replace(/_/g, "").toLowerCase();
    if (normalized === "userid") mapping.userId = column_name;
    if (normalized === "accountid") mapping.accountId = column_name;
    if (normalized === "isprimary") mapping.isPrimary = column_name;
  }
  if (!mapping.userId || !mapping.accountId) return null;
  return { table, columns: mapping as Record<ColumnKey, string> };
}

function quote(identifier: string) {
  return `"${identifier.replace(/["';]/g, "")}"`;
}

async function main() {
  const { json } = parseArgs(process.argv.slice(2));
  const auth = await openDatabase("AUTH_DATABASE_URL", process.env.AUTH_DATABASE_URL, true);
  const builders = await openDatabase(
    "BUILDERS_DATABASE_URL",
    process.env.BUILDERS_DATABASE_URL,
    true,
  );
  const credits = await openDatabase(
    "CREDITS_DATABASE_URL",
    process.env.CREDITS_DATABASE_URL,
    true,
  );
  if (!auth || !builders) {
    usage();
    process.exitCode = 2;
    return;
  }

  const linkTable = await discoverLinkTable(auth);
  if (!linkTable) {
    console.error(
      "No NEAR account-link table found in the auth database (expected one named like 'nearAccount' or 'near_account').",
    );
    process.exitCode = 2;
    return;
  }

  const linkRows = await auth.query<{ user_id: string; account_id: string; is_primary: boolean }>(
    `SELECT ${quote(linkTable.columns.userId)} AS user_id, ${quote(linkTable.columns.accountId)} AS account_id, ${
      linkTable.columns.isPrimary
        ? `${quote(linkTable.columns.isPrimary)} AS is_primary`
        : "false AS is_primary"
    } FROM ${quote(linkTable.table)}`,
  );
  const links: NearLink[] = linkRows.rows.map((row) => ({
    userId: row.user_id,
    accountId: row.account_id,
    isPrimary: row.is_primary ?? false,
  }));

  const profileRows = await builders.query<{
    near_account: string;
    user_id: string | null;
    withdrawn_at: Date | null;
  }>("SELECT near_account, user_id, withdrawn_at FROM builders");
  const profiles: ProfileRow[] = profileRows.rows.map((row) => ({
    nearAccount: row.near_account,
    userId: row.user_id,
    withdrawnAt: row.withdrawn_at,
  }));

  let claims: ClaimRow[] = [];
  if (credits) {
    const claimRows = await credits.query<{ near_account_id: string; status: string }>(
      "SELECT near_account_id, status FROM credit_claims",
    );
    claims = claimRows.rows.map((row) => ({
      nearAccountId: row.near_account_id,
      status: row.status,
    }));
  }

  await auth.end().catch(() => undefined);
  await builders.end().catch(() => undefined);
  await credits?.end().catch(() => undefined);

  const report = buildAuditReport({ links, profiles, claims });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const fmt = (value: string | null) => value ?? "—";
  console.log(`Credits eligibility audit — ${report.counts.users} linked users
`);
  for (const user of report.users) {
    const marker = user.fixable ? "FIXABLE" : user.runtimeEligible ? "" : user.verdict;
    if (!user.fixable && user.runtimeEligible) continue;
    console.log(
      [
        `user ${fmt(user.userId)}`,
        `primary=${fmt(user.primaryAccountId)}${user.hasPrimaryMarker ? "" : " (no marker)"}`,
        `verdict=${user.verdict}${marker ? ` [${marker}]` : ""}`,
        user.linkedProfileAccounts.length > 0
          ? `approved profile under linked account: ${user.linkedProfileAccounts.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }
  if (report.orphanedClaims.length > 0) {
    console.log(`
Orphaned claim rows (no linked user):`);
    for (const claim of report.orphanedClaims) {
      console.log(`  ${claim.nearAccountId} — ${claim.statuses.join(", ")}`);
    }
  }
  console.log(
    `
Summary: ${report.counts.fixable} fixable · ${report.counts.withdrawn} withdrawn · ${report.counts.missingProfile} missing profile · ${report.counts.orphanedClaims} orphaned claims`,
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
