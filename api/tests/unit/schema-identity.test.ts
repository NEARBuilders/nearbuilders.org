import { readdirSync } from "node:fs";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

/**
 * Guard for the identity convention (#329, #369): app data never keys on a session, and each
 * column holding an auth user id has its own NEAR-account sibling in the same table, so rows
 * survive the shared auth DB reissuing user ids.
 */
const SESSION_COLUMN = /(^|_)session(_|$)/;
const USER_ID_COLUMN = /(^|_)user_id$/;
/** External-platform ids that happen to end in user_id; they are not auth user ids. */
const EXTERNAL_ID_COLUMNS = new Set(["x_user_id"]);
const isAuthUserIdColumn = (column: string) =>
  USER_ID_COLUMN.test(column) && !EXTERNAL_ID_COLUMNS.has(column);

/**
 * The sibling must share the user id column's prefix: `submitted_user_id` needs
 * `submitted_near_account` (or `submitted_near_account_id`). Any other account-like column in
 * the table (e.g. project_apps.account_id, the app's own account) doesn't count.
 */
function accountSiblings(userIdColumn: string) {
  const prefix = userIdColumn.slice(0, -"user_id".length);
  return [`${prefix}near_account`, `${prefix}near_account_id`];
}

function userIdColumnsWithoutAccount(table: { name: string; columns: string[] }) {
  return table.columns
    .filter(isAuthUserIdColumn)
    .filter((column) => !accountSiblings(column).some((s) => table.columns.includes(s)))
    .map((column) => `${table.name}.${column}`);
}

/**
 * Known exceptions as `table.column`, each tracked by a ticket. Remove an entry when its fix
 * lands. (Stale entries don't fail the test, so the fix PRs can merge in any order.)
 */
const USER_ID_WITHOUT_ACCOUNT: Record<string, string> = {
  // Holds the recipient's owner id (account, or user id without NEAR); misnamed (#367).
  "notifications.user_id": "#367",
  // Holds the participant's owner id; the account is in wallet_address (#367).
  "event_participants.user_id": "#367",
  // Holds the inviter's owner id; misnamed (#367).
  "project_collaborators.invited_by_user_id": "#367",
  // Holds the creator's owner id; misnamed (audit L2, #329). account_id is the app's own
  // account, not the creator's, so it is not a sibling.
  "project_apps.created_by_user_id": "#329 L2",
  // Keyed on the bare user id until #370 lands; remove both entries when it merges.
  "upvotes.user_id": "#359",
  "bookmarks.user_id": "#360",
  // Keyed on the admin's user id until #371 lands; remove both entries when it merges.
  "telegram_link_codes.user_id": "#361",
  "telegram_reviewers.user_id": "#361",
};

const pluginsDir = new URL("../../../plugins/", import.meta.url);
const schemaModules = readdirSync(pluginsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => readdirSync(new URL(`${name}/src/`, pluginsDir)).includes("db"))
  .filter((name) => readdirSync(new URL(`${name}/src/db/`, pluginsDir)).includes("schema.ts"));

async function loadTables() {
  const tables: Array<{ plugin: string; name: string; columns: string[] }> = [];
  for (const plugin of schemaModules) {
    const schema = await import(new URL(`${plugin}/src/db/schema.ts`, pluginsDir).href);
    for (const value of Object.values(schema)) {
      if (!is(value, PgTable)) continue;
      const config = getTableConfig(value as PgTable);
      tables.push({ plugin, name: config.name, columns: config.columns.map((c) => c.name) });
    }
  }
  return tables;
}

describe("plugin schema identity (#369)", () => {
  it("finds the plugin tables", async () => {
    expect((await loadTables()).length).toBeGreaterThan(15);
  });

  it("never stores a session id", async () => {
    const offenders = (await loadTables()).flatMap((table) =>
      table.columns
        .filter((column) => SESSION_COLUMN.test(column))
        .map((column) => `${table.plugin}:${table.name}.${column}`),
    );
    expect(offenders).toEqual([]);
  });

  it("gives every user id column its own NEAR-account sibling", async () => {
    const offenders = (await loadTables()).flatMap(userIdColumnsWithoutAccount);
    expect(offenders.filter((name) => !(name in USER_ID_WITHOUT_ACCOUNT))).toEqual([]);
  });

  it("pairs each user id column with its own sibling, not any account column", () => {
    expect(
      userIdColumnsWithoutAccount({
        name: "t",
        columns: ["user_id", "near_account", "created_by_user_id", "account_id", "x_user_id"],
      }),
    ).toEqual(["t.created_by_user_id"]);
    expect(
      userIdColumnsWithoutAccount({
        name: "t",
        columns: ["user_id", "account_id", "submitted_user_id", "submitted_near_account"],
      }),
    ).toEqual(["t.user_id"]);
  });
});
