declare module "virtual:drizzle-migrations.sql" {
  export interface Migration {
    hash: string;
    tag: string;
    sql: string[];
  }

  const migrations: Migration[];
  export default migrations;
}
