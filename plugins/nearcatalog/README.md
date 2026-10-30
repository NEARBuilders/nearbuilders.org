# NEAR Catalog plugin

Searches [NEAR Catalog](https://nearcatalog.xyz), stores project claims, and keeps the
nearbuilders.org listings that an admin approved for NEAR Catalog (`nearcatalog_listings`).
Approved listings are exported at `GET /api/v1/nearcatalog/export/{projects,people}?since=`.

## Sending listings to NEAR Catalog

The plugin can send approved projects straight to NEAR Catalog's partner-submit API
([#290](https://github.com/NEARBuilders/nearbuilders.org/issues/290)). It is off until the partner
key is set:

| Secret | What it is |
| --- | --- |
| `NEARCATALOG_PARTNER_KEY` | Partner key NEAR Catalog gives nearbuilders.org (`nc_partner_...`). Sent only in the auth header, never logged, returned or shown in the UI |
| `NEARCATALOG_SUBMIT_URL` | Optional. Defaults to `https://indexer.nearcatalog.xyz/wp-json/nearcatalog/v1/partner-submit` |
| `NEARCATALOG_CONTACT` | Email or Telegram handle NEAR Catalog's curators can reach us on. Without it, the project's Telegram link is used, and a project without one fails to send |

Without the key, approvals work exactly as before: nothing is sent, nothing is queued, and no
error is stored. The export endpoints keep working in both modes.

### When it sends

| Event on nearbuilders.org | What happens |
| --- | --- |
| An admin approves a project listing | submit |
| A big edit goes back to review and an admin approves it again | submit (same `uid`, so it is an update request) |
| A small edit to an approved project listing | submit |
| Rejected, withdrawn, made private, deleted or removed by an admin, after it was sent | flagged in the admin tab: NEAR Catalog has no partner remove route, so ask their team to hide it |

People listings are not sent: the partner API takes projects only. They stay in the people export.

A pending re-review sends nothing. Every submission goes to NEAR Catalog's curators, and nothing
changes on nearcatalog.xyz until they approve it. Unreviewed submissions expire after 7 days.

The approval itself never waits on NEAR Catalog for long and never fails because of it. Each
request times out after 5 seconds. A failure is saved on the listing (`send_status`,
`send_action`, `send_error`, `send_attempted_at`) and shown in the admin dashboard's NEAR
Catalog tab with a **Retry** button. Listings approved before sending was set up show a
**Send** button there. Retries reuse the `uid`, so NEAR Catalog matches them to the same project.

A successful send leaves the listing `approved` and records `send_status: sent`. It becomes
`published` only once it is live on NEAR Catalog.

### Request

Follows NEAR Catalog's partner submission guide. It lives in one place,
`src/services/catalog-submit.ts`.

```http
POST {NEARCATALOG_SUBMIT_URL}
Authorization: Bearer {NEARCATALOG_PARTNER_KEY}
Content-Type: application/json
```

- Body: the export record mapped to NEAR Catalog's fields: `project_name`, `project_description`,
  `project_logo`, `contact_info`, `one_liner`, `primary_category` (category labels, comma-separated,
  first one primary), `uid` (`project:<nearbuilders project id>`), plus the links, phase and token
  fields when set. Empty fields are left out.
- Success is HTTP 200 with `{ "status": "success", "submission_id": "..." }`.
- Anything else, or a timeout, is a failure. NEAR Catalog returns validation errors as 500 with a
  `message` such as `Missing required fields: ...`. That message is kept as the error.

### Admin endpoints

```http
GET  /api/v1/nearcatalog/listings/sends         # send status per listing, and whether sending is on
POST /api/v1/nearcatalog/listings/sends/retry   # { "kind": "project", "entityId": "<id>" }
```

Both need an admin session.
