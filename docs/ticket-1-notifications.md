### Context
There will be an upcoming Legion mission for Ascendent rank to be created (see https://github.com/NEARBuilders/bot.nearbuilders.org/issues/2), we need to introduce notifications to serve as proof for the mission. This should be a generic plugin following the same pattern as `plugins/votes/`. The API layer (`api/src/index.ts`) already orchestrates across plugins via `createCallbacks`, so this means that after approval, when the handler calls into project/event/builder plugins, this notification emission will hook in.

### Overview
Create `plugins/notifications`, a generic notification store following the [every-plugin](https://tanstack.com/intent/registry/every-plugin) framework.  You will need to implement the oRPC contract, Effect-TS service + SSE, and wire into `api/src/contract.ts` as passthrough. In `api/src/index.ts`, when the `approve` handler, after a `createCallback` succeeds, emit a notification for the affected user. On the UI, add a bell icon in `user-nav.tsx` with unread count badge, dropdown with recent notifications, full page at `/profile/notifications` with read/unread persistence via TanStack Query (not localStorage).

### Acceptance Criteria

**Plugin & API:**
- [ ] `plugins/notifications` following every-plugin scaffold
- [ ] Drizzle schema: `notifications` — `id`, `userId` (recipient), `type` (string: "project_approved"|"event_approved"|"builder_approved"|"claim_approved"|...), `source` (string — which plugin emitted it), `subject` (string), `body` (string, nullable), `link` (string — URL to navigate to), `read` (boolean), `created_at`
- [ ] oRPC contract:
  - `createNotification` — POST `/v1/notifications`, input `{ userId, type, source, subject, body?, link? }`, errors UNAUTHORIZED
  - `getMyNotifications` — GET `/v1/notifications/me`, input `{ read?, limit?, cursor? }`, output paginated `{ data: Notification[], meta }`
  - `markAsRead` — POST `/v1/notifications/{id}/read`, input `{ id }`
  - `markAllAsRead` — POST `/v1/notifications/me/read-all`
  - `subscribeNotifications` — GET `/v1/notifications/stream`, output SSE event iterator
- [ ] Effect-TS service with Drizzle repository
- [ ] MemoryPublisher for SSE streaming
- [ ] API passthrough in `api/src/contract.ts`: all routes requireAuth (user-scoped)
- [ ] `api/src/index.ts` `approve` handler: after a `createCallback` succeeds, emit notification:
  - Project approved → notify `proposal.createdBy` with `type: "project_approved"`, `link: "/projects/project/{slug}"`
  - Event approved → notify `proposal.createdBy` with `type: "event_approved"`, `link: "/events/{slug}"`
  - Builder approved → notify `proposal.createdBy` with `type: "builder_approved"`, `link: "/builders/{account}"`
- [ ] Registered in `bos.config.json` with `NOTIFICATIONS_DATABASE_URL` secret
- [ ] `bos types gen` + `bun typecheck` passes

**UI:**
- [ ] Bell icon in `user-nav.tsx` visible to logged-in users, with unread count badge (red dot or number)
- [ ] Clicking bell opens dropdown: recent 5 notifications + "View all" link
- [ ] Dropdown notification items show: source icon/type, subject, relative timestamp, read/unread indicator (bold vs. normal)
- [ ] `routes/_layout/_authenticated/_dashboard/notifications.tsx` — full notifications page
- [ ] Notification cards show: source icon, type badge, subject, body preview, timestamp, read/unread indicator
- [ ] Clicking a notification: marks as read + navigates to `link`
- [ ] "Mark all as read" button
- [ ] Read/unread state persisted via TanStack Query cache (refreshing retains read status, not localStorage)
- [ ] SSE subscription for real-time new notifications (badge updates live)
- [ ] Loading skeleton, empty state ("No notifications yet")
- [ ] Must follow everything-dev and every-plugin best practices
