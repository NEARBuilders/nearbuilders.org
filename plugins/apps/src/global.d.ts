/**
 * FRAMEWORK-OWNED — reconciled from the parent template by `bos upgrade`.
 * Local edits are allowed: on the next upgrade the template version wins and your
 * copy is backed up under `.bos/sync-backup/`. To make a change permanent, file an
 * issue: https://github.com/NEARBuilders/everything-dev/issues
 */
declare module "virtual:drizzle-migrations.sql" {
  export interface Migration {
    idx: number;
    when: number;
    tag: string;
    hash: string;
    sql: string[];
  }

  const migrations: Migration[];
  export default migrations;
}
