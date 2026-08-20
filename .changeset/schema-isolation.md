---
"api": minor
"@everything-dev/activity-plugin": minor
"@everything-dev/builders-plugin": minor
"@everything-dev/events-plugin": minor
"@everything-dev/nearcatalog-plugin": minor
"@everything-dev/notifications-plugin": minor
"@everything-dev/projects-plugin": minor
"@everything-dev/proposals-plugin": minor
"@everything-dev/votes-plugin": minor
---

Isolate each plugin's data tables into a dedicated PostgreSQL schema (`plugin_<slug>`) instead of sharing the `public` schema. The API keeps its tables in `public`.

Each plugin now creates `CREATE SCHEMA IF NOT EXISTS plugin_<slug>` on pool connect (via a single multi-statement query to avoid a first-query race) and sets `search_path` so unqualified DDL and queries route to the plugin schema. Drizzle migration SQL with `"public".` FK qualifiers is stripped at apply time so self-referential foreign keys resolve within the new schema.

Existing production tables in `public` are automatically adopted on the next boot: `ALTER TABLE "public".<table> SET SCHEMA plugin_<slug>` relocates them (preserving all data, indexes, and constraints) before migration drift detection runs, so deployed plugins with real data upgrade without throwing `drift-safe-repair`.

The debug `pool.end()` stack-trace logging has been removed.
