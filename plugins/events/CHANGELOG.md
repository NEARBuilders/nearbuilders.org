# @everything-dev/events-plugin

## 1.1.0

### Minor Changes

- Add events plugin with full CRUD, participant management, and Luma import (#24).

  - **events plugin**: Full events plugin providing create, read, update, delete, and participant join/leave flows backed by a PostgreSQL schema. Supports event visibility levels and status tracking.
  - **api**: Expose events endpoints — list, create, get, update, delete, join/leave participants, list participants, and fetch event metadata from external Luma URLs.
  - **ui**: Public events pages at `/events` with listing, detail, creation, and editing views. Admin dashboard now supports events proposals alongside builders and projects.
  - **infra**: New `postgres-events` container, `EVENTS_DATABASE_URL` env var, and port renumbering for the existing plugin databases.

- 22f3232: Integrate Luma calendar subscriptions to display external events alongside internal NEAR Builders events (#77).

  - **events plugin**: New `LumaService` with calendar key configuration (comma-separated `LUMA_CALENDAR_API_KEYS`), calendar metadata fetching, paginated event aggregation with cursor-based navigation across multiple calendars, in-memory caching with TTL and concurrent request deduplication, and admin visibility for private events.
  - **api**: New `listLumaCalendars`, `listLumaEvents`, and `getLumaEvent` endpoints. Luma endpoints receive user context for admin role detection.
  - **ui**: Luma events display alongside internal events on `/events` with calendar source filtering dropdown, URL-based deduplication across sources, Luma event detail pages at `/events/luma/$calendarId/$eventId`, and a re-usable `EventDetail` component shared between internal and Luma event views.

### Patch Changes

- 1c028d1: Fix PR review issues from #27: slug API paths, kind validation, filter preservation, and event error handling.

  - **api**: Change slug lookup paths from `/v1/{resource}/slug/{slug}` to `/v1/{resource}/by-slug/{slug}` for both projects and events.
  - **events plugin**: Remove redundant SELECT-before-INSERT duplicate slug check (DB unique constraint + catch handler suffice).
  - **projects plugin**: Re-add `isProjectKind` validation in `beforeLoad` on project detail and edit routes to redirect invalid kinds to `/projects`.
  - **projects plugin**: Restore `kind` search param in navigation links so the kind filter is preserved when moving between list, detail, and edit views.
  - **ui**: Change `reviewFailed` toast on event creation to include actionable guidance ("Edit to resubmit.").
  - **fix**: Correct `vitest` catalog reference from `"^catalog:"` to `"catalog:"`.
