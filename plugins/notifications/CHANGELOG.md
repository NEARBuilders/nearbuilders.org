# @everything-dev/notifications-plugin

## 1.1.0

### Minor Changes

- 164ae1c: Add notifications plugin with approval alerts and real-time delivery (#30).

  - **notifications plugin**: New generic notification store following the every-plugin scaffold — oRPC contract (`createNotification`, `getMyNotifications`, `markAsRead`, `markAllAsRead`, `subscribeNotifications`), an Effect-TS service backed by a Drizzle PostgreSQL schema, and a `MemoryPublisher` for SSE streaming. All read/write routes are user-scoped.
  - **api**: Passthrough for the user-facing notification routes (all `requireAuth`), scoped to the caller's NEAR account. The `approve` handler emits a best-effort notification to `proposal.createdBy` after a successful apply — `project_approved`, `event_approved`, or `builder_approved` with a deep link to the new resource. SSE `signal`/`lastEventId` are forwarded so reconnects resume cleanly.
  - **ui**: Bell icon in the header (left of the avatar on desktop, left of the menu button on mobile) with a live unread badge, a dropdown of recent notifications with per-item "mark as read", and a full `/notifications` page with infinite scroll, optimistic mark-read / mark-all-read, loading/empty/error states, and SSE-driven live updates. Read state is persisted via the TanStack Query cache.
  - **infra**: New `postgres-notifications` container and `NOTIFICATIONS_DATABASE_URL` env var.
