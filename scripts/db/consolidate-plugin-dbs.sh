#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Restore each per-plugin v1 database into its own plugin_<slug> schema on one
target database, carry over the v1 migration journal, and verify row counts.

Usage:
  TARGET_DATABASE_URL=postgres://... scripts/db/consolidate-plugin-dbs.sh [slug ...]

Sources:
  <SLUG>_SOURCE_DATABASE_URL, falling back to <SLUG>_DATABASE_URL.

Defaults:
  slugs: activity bookmarks builders events nearcatalog notifications projects proposals votes
  PG_IMAGE: postgres:17-alpine (used when pg_dump/pg_restore/psql are not on PATH)

The target must not already contain tables in a plugin_<slug> schema being
restored. Source databases are only read. The target's public schema is
never touched. A scratch database per plugin is created and dropped on the
target server, so the target role needs CREATEDB.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required (see --help)}"
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine}"
DEFAULT_SLUGS=(activity bookmarks builders events nearcatalog notifications projects proposals votes)
if [[ $# -gt 0 ]]; then SLUGS=("$@"); else SLUGS=("${DEFAULT_SLUGS[@]}"); fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pg() {
  if command -v "$1" >/dev/null 2>&1; then
    "$@"
  else
    docker run --rm -i --network host --user "$(id -u):$(id -g)" -v "$WORK:$WORK:z" "$PG_IMAGE" "$@"
  fi
}

with_database() {
  local url="$1" name="$2" base query=""
  base="${url%%\?*}"
  [[ "$url" == *\?* ]] && query="?${url#*\?}"
  printf '%s/%s%s' "${base%/*}" "$name" "$query"
}

source_url() {
  local slug="$1" upper
  upper="$(printf '%s' "$slug" | tr '[:lower:]-' '[:upper:]_')"
  local primary="${upper}_SOURCE_DATABASE_URL" fallback="${upper}_DATABASE_URL"
  local url="${!primary:-${!fallback:-}}"
  [[ -n "$url" ]] || { echo "missing ${primary} (or ${fallback}) for ${slug}" >&2; exit 1; }
  printf '%s' "$url"
}

sql() {
  pg psql "$1" -v ON_ERROR_STOP=1 -Atqc "$2"
}

failures=0

for slug in "${SLUGS[@]}"; do
  schema="plugin_${slug//-/_}"
  src="$(source_url "$slug")"

  existing="$(sql "$TARGET_DATABASE_URL" "select count(*) from information_schema.tables where table_schema = '${schema}'")"
  if [[ "$existing" != "0" ]]; then
    echo "refusing ${slug}: target already has ${existing} table(s) in ${schema}" >&2
    exit 1
  fi

  scratch_name="consolidate_${slug//-/_}_$$"
  scratch="$(with_database "$TARGET_DATABASE_URL" "$scratch_name")"
  dump="$WORK/${slug}.public.dump"
  renamed="$WORK/${slug}.schema.dump"

  pg pg_dump "$src" -n public --no-owner --no-privileges -Fc -f "$dump"
  sql "$TARGET_DATABASE_URL" "create database ${scratch_name}"
  sql "$scratch" "drop schema if exists public cascade"
  pg pg_restore -d "$scratch" --no-owner --no-privileges --exit-on-error "$dump"
  sql "$scratch" "alter schema public rename to ${schema}"
  pg pg_dump "$scratch" -n "$schema" --no-owner --no-privileges -Fc -f "$renamed"
  sql "$TARGET_DATABASE_URL" "drop schema if exists ${schema}"
  pg pg_restore -d "$TARGET_DATABASE_URL" --no-owner --no-privileges --exit-on-error "$renamed"
  sql "$TARGET_DATABASE_URL" "drop database ${scratch_name}"

  has_journal="$(sql "$src" "select count(*) from information_schema.tables where table_schema = 'drizzle' and table_name = '__drizzle_migrations'")"
  if [[ "$has_journal" == "1" ]]; then
    sql "$src" "copy (select hash, created_at from drizzle.__drizzle_migrations order by id) to stdout" \
      | pg psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q \
        -c "create schema if not exists drizzle" \
        -c "create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)" \
        -c "create temp table incoming (hash text, created_at bigint)" \
        -c "copy incoming from stdin" \
        -c "insert into drizzle.__drizzle_migrations (hash, created_at) select i.hash, i.created_at from incoming i where not exists (select 1 from drizzle.__drizzle_migrations m where m.hash = i.hash)"
    journal="$(sql "$src" "select count(*) from drizzle.__drizzle_migrations")"
  else
    journal="none"
    echo "warning: ${slug} source has no drizzle.__drizzle_migrations; v2 will replay non-CREATE migrations" >&2
  fi

  tables="$(sql "$src" "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1")"
  for table in $tables; do
    a="$(sql "$src" "select count(*) from public.\"${table}\"")"
    b="$(sql "$TARGET_DATABASE_URL" "select count(*) from ${schema}.\"${table}\"")"
    if [[ "$a" == "$b" ]]; then
      printf '  %-14s %-32s %8s rows\n' "$slug" "$table" "$a"
    else
      printf '  %-14s %-32s MISMATCH source=%s target=%s\n' "$slug" "$table" "$a" "$b" >&2
      failures=$((failures + 1))
    fi
  done
  echo "restored ${slug} into ${schema} (journal: ${journal})"
done

if [[ "$failures" -gt 0 ]]; then
  echo "${failures} table(s) with row-count mismatches" >&2
  exit 1
fi
echo "all row counts match"
