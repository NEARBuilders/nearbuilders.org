# NEAR Catalog plugin

Searches [NEAR Catalog](https://nearcatalog.xyz), stores project claims, and keeps the
nearbuilders.org listings that an admin approved for NEAR Catalog (`nearcatalog_listings`).
Approved listings are exported at `GET /api/v1/nearcatalog/export/{projects,people}?since=`.

## Sending listings to NEAR Catalog

The plugin can send approved listings straight to NEAR Catalog's API
([#290](https://github.com/NEARBuilders/nearbuilders.org/issues/290)). It is off until both
secrets are set:

| Secret | What it is |
| --- | --- |
| `NEARCATALOG_SUBMIT_URL` | Base URL of NEAR Catalog's submission API, for example `https://api.nearcatalog.xyz/v1/submissions` |
| `NEARCATALOG_SUBMIT_TOKEN` | Token NEAR Catalog gives nearbuilders.org. Sent only as a Bearer header, never logged, returned or shown in the UI |

With either one unset, approvals work exactly as before: nothing is sent, nothing is queued,
and no error is stored. The export endpoints keep working in both modes.

### When it sends

| Event on nearbuilders.org | Request |
| --- | --- |
| An admin approves a listing | upsert |
| A big edit goes back to review and an admin approves it again | upsert (same external id, so it updates) |
| A small edit to an approved listing | upsert |
| Rejected, withdrawn, made private, deleted or removed by an admin, after it was sent | remove |

A pending re-review sends nothing, so NEAR Catalog keeps the last approved version until the
admin decides.

The approval itself never waits on NEAR Catalog for long and never fails because of it. Each
request times out after 5 seconds. A failure is saved on the listing (`send_status`,
`send_action`, `send_error`, `send_attempted_at`) and shown in the admin dashboard's NEAR
Catalog tab with a **Retry** button. Listings approved before sending was set up show a
**Send** button there. Retries reuse the external id, so they can't create duplicates.

On success the listing is marked `published`, and the slug and URL NEAR Catalog returns are
stored. Without a URL in the reply, projects link to `https://nearcatalog.xyz/project/{slug}`.

### Request shape (proposal for NEAR Catalog to confirm)

NEAR Catalog hasn't published this API yet. This is what we send today. It lives in one place,
`src/services/catalog-submit.ts`, so it can change once they confirm theirs.

```http
PUT    {NEARCATALOG_SUBMIT_URL}/projects/{externalId}
PUT    {NEARCATALOG_SUBMIT_URL}/people/{externalId}
DELETE {NEARCATALOG_SUBMIT_URL}/projects/{externalId}
DELETE {NEARCATALOG_SUBMIT_URL}/people/{externalId}
Authorization: Bearer {NEARCATALOG_SUBMIT_TOKEN}
Content-Type: application/json
```

- `externalId` is stable and URL-encoded: `project:<nearbuilders project id>` or
  `person:<NEAR account>`.
- Upsert body: `{ "source": "nearbuilders", "externalId", "kind": "project" | "person", "record" }`.
  `record` is exactly one item of the export endpoint (same field names as NEAR Catalog's
  submission form, categories as slugs such as `developer-tooling`).
- Remove body: `{ "source": "nearbuilders", "externalId", "kind" }`. A `404` counts as removed.
- Expected upsert reply: `{ "slug": "lantern-pay", "url": "https://nearcatalog.xyz/project/lantern-pay" }`.
  Both are optional.
- Any non-2xx reply or a timeout is a failure. The first 300 characters of the reply are kept as
  the error.

Open questions for NEAR Catalog are listed on #290: required fields, whether they publish right
away or review first, and the people id.

### Admin endpoints

```http
GET  /api/v1/nearcatalog/listings/sends         # send status per listing, and whether sending is on
POST /api/v1/nearcatalog/listings/sends/retry   # { "kind": "project", "entityId": "<id>" }
```

Both need an admin session.
