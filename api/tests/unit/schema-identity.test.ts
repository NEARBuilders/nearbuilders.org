import { readdirSync } from "node:fs";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

/**
 * Guard for the identity convention (#329, #369): app data never keys on a session, and a
 * column holding an auth user id always has a NEAR-account sibling in the same table, so rows
 * survive the shared auth DB reissuing user ids.
 */
const SESSION_COLUMN = /(^|_)session(_|$)/;
const USER_ID_COLUMN = /(^|_)user_id$/;
const ACCOUNT_COLUMN = /(^|_)(near_account|account_id|near_account_id)$/;
/** External-platform ids that happen to end in user_id; they are not auth user ids. */
const EXTERNAL_ID_COLUMNS = new Set(["x_user_id"]);
const isAuthUserIdColumn = (column: string) =>
  USER_ID_COLUMN.test(column) && !EXTERNAL_ID_COLUMNS.has(column);

/**
 * Known exceptions, each tracked by a ticket. Remove an entry when its fix lands. (Stale
 * entries don't fail the test, so the fix PRs can merge in any order.)
 */
const USER_ID_WITHOUT_ACCOUNT: Record<string, string> = {
  // Holds the recipient's owner id (account, or user id without NEAR); misnamed (#367).
  notifications: "#367",
  // Holds the participant's owner id; the account is in wallet_address (#367).
  event_participants: "#367",
  // invited_by_user_id holds the inviter's owner id (#367).
  project_collaborators: "#367",
  // Keyed on the bare user id until #370 lands.
  upvotes: "#359",
  bookmarks: "#360",
  // Keyed on the admin's user id until #371 lands.
  telegram_link_codes: "#361",
  telegram_reviewers: "#361",
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

  it("gives every user id column a NEAR-account sibling", async () => {
    const offenders = (await loadTables())
      .filter((table) => table.columns.some(isAuthUserIdColumn))
      .filter((table) => !table.columns.some((column) => ACCOUNT_COLUMN.test(column)))
      .map((table) => table.name);
    expect(offenders.filter((name) => !(name in USER_ID_WITHOUT_ACCOUNT))).toEqual([]);
  });
});
