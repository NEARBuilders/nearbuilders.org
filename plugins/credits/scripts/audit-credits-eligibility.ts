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

All connections are read-only. Tables are auto-discovered by name across
every schema (e.g. the builders table may live under plugin_builders);
the resolved table paths print with the report. Verdicts only — pair
users with a case-by-case fix.`);
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
): Promise<Client | null> {
  if (!url) return null;
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");
  return client;
}

function quote(identifier: string) {
  return `"${identifier.replace(/["';]/g, "")}"`;
}

type DiscoveredTable = { qualified: string; schema: string; table: string; columns: string[] };

async function discoverTable(
  client: Client,
  connection: string,
  pattern: RegExp,
): Promise<DiscoveredTable | null> {
  const tables = await client.query<{ table_schema: string; table_name: string }>(
    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1, 2",
  );
  const matches = tables.rows.filter((row) => pattern.test(row.table_name));
  const chosen = matches.find((row) => row.table_schema === "public") ?? matches[0];
  if (!chosen) {
    console.error(
      `No table matching ${pattern} found in ${connection}. Tables present:
  ${tables.rows.map((row) => `${row.table_schema}.${row.table_name}`).join("\n  ")}`,
    );
    return null;
  }
  const columns = await client.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position",
    [chosen.table_schema, chosen.table_name],
  );
  return {
    qualified: `${quote(chosen.table_schema)}.${quote(chosen.table_name)}`,
    schema: chosen.table_schema,
    table: chosen.table_name,
    columns: columns.rows.map((row) => row.column_name),
  };
}

async function main() {
  const { json } = parseArgs(process.argv.slice(2));
  const auth = await openDatabase("AUTH_DATABASE_URL", process.env.AUTH_DATABASE_URL);
  const builders = await openDatabase("BUILDERS_DATABASE_URL", process.env.BUILDERS_DATABASE_URL);
  const credits = await openDatabase("CREDITS_DATABASE_URL", process.env.CREDITS_DATABASE_URL);
  if (!auth || !builders) {
    usage();
    process.exitCode = 2;
    return;
  }

  const linkTable = await discoverTable(auth, "AUTH_DATABASE_URL", /near_?accounts?$/i);
  if (!linkTable) {
    process.exitCode = 2;
    return;
  }

  const normalized = (column: string) => column.replace(/_/g, "").toLowerCase();
  const mapping: Partial<Record<ColumnKey, string>> = {};
  for (const column of linkTable.columns) {
    const normalizedColumn = normalized(column);
    if (normalizedColumn === "userid") mapping.userId = column;
    if (normalizedColumn === "accountid") mapping.accountId = column;
    if (normalizedColumn === "isprimary") mapping.isPrimary = column;
  }
  if (!mapping.userId || !mapping.accountId) {
    console.error(
      `The link table ${linkTable.qualified} does not expose user/account id columns (found: ${linkTable.columns.join(", ")}).`,
    );
    process.exitCode = 2;
    return;
  }

  const buildersTable = await discoverTable(builders, "BUILDERS_DATABASE_URL", /^builders$/i);
  if (!buildersTable) {
    process.exitCode = 2;
    return;
  }

  const claimsTable = credits
    ? await discoverTable(credits, "CREDITS_DATABASE_URL", /^credit_claims$/i)
    : null;

  const linkRows = await auth.query<{ user_id: string; account_id: string; is_primary: boolean }>(
    `SELECT ${quote(mapping.userId!)} AS user_id, ${quote(mapping.accountId!)} AS account_id, ${
      mapping.isPrimary ? `${quote(mapping.isPrimary)} AS is_primary` : "false AS is_primary"
    } FROM ${linkTable.qualified}`,
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
  }>(`SELECT near_account, user_id, withdrawn_at FROM ${buildersTable.qualified}`);
  const profiles: ProfileRow[] = profileRows.rows.map((row) => ({
    nearAccount: row.near_account,
    userId: row.user_id,
    withdrawnAt: row.withdrawn_at,
  }));

  let claims: ClaimRow[] = [];
  if (credits && claimsTable) {
    const claimRows = await credits.query<{ near_account_id: string; status: string }>(
      `SELECT near_account_id, status FROM ${claimsTable.qualified}`,
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
    console.log(JSON.stringify({ claimTable: claimsTable?.qualified ?? null, ...report }, null, 2));
    return;
  }

  const fmt = (value: string | null) => value ?? "—";
  console.log(
    `Credits eligibility audit — ${report.counts.users} linked users
  auth link table: ${linkTable.qualified}
  builders table:  ${buildersTable.qualified}
  claims table:    ${fmt(claimsTable?.qualified ?? null)}
`,
  );
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
