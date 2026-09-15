# Activity plugin

Records nearbuilders.org activity: proposal approvals, NEAR Catalog claims, and self-reported
profile entries. It serves the site's activity feed, live stream, and leaderboard.

## Forwarding activity to activity.nearbuilders.org

The activity plugin can forward its trusted writes to the standalone Activity service while
continuing to write its own table. This is the reversible writer path for
[activity.nearbuilders.org#13](https://github.com/NEARBuilders/activity.nearbuilders.org/issues/13).

## Modes

The mode is stored in the plugin's database (`activity_settings`), so it changes without a
redeploy. Only administrators can read or change it.

| Mode | Legacy table | activity.nearbuilders.org |
| --- | --- | --- |
| `legacy-only` (default) | written | not called |
| `dual-write` | written | published, and retracted when an event is hidden |
| `standalone-only` | not written | published and retracted |

```http
GET  /api/plugins/activity/v1/internal/activity/gateway         # status
PUT  /api/plugins/activity/v1/internal/activity/gateway/mode    # { "mode": "dual-write" }
POST /api/plugins/activity/v1/internal/activity/gateway/retry   # retry queued work now
```

## What is forwarded

| Legacy `source` / `type` | Activity Event Type | Written by |
| --- | --- | --- |
| `projects` / `approved` | `project.approved` | proposal approval |
| `events` / `approved` | `event.approved` | proposal approval |
| `builders` / `approved` | `builder.approved` | proposal approval |
| `nearcatalog` / `claim` | `nearcatalog.claim` | NEAR Catalog claim |

Only `emitTrustedActivity` forwards. Self-reported profile uploads (`emitActivity`) stay in the
legacy table: Activity signs everything nearbuilders.org sends with the nearbuilders.org source
identity, so forwarding user-supplied claims would present them as vouched for by nearbuilders.org.
Hiding a legacy event that was never forwarded does nothing extra.

## Delivery and failures

Every forwarded write is recorded in `activity_gateway_outbox` before it is sent, keyed by the
legacy operation's existing idempotency key, and the returned Activity event ID is stored on the
row. A send is attempted immediately, and a background worker retries pending rows every 30
seconds with backoff.

- Server errors, rate limits, and network failures stay `pending` and are retried, up to 8 attempts.
- Rejections (400, 401, 403, 409) are marked `failed` immediately and appear in the status
  response with their error, because retrying cannot help.
- A retraction waits until its publish has reached Activity, so it can never run first.
- A failed forward never fails the legacy write. The status endpoint is the signal that
  something needs attention.

## Deployment order

1. Deploy this plugin with no gateway secrets. Everything stays `legacy-only`.
2. In activity.nearbuilders.org, register the `nearbuilders` source, approve it, bind its signing
   identity, add the four Event Types above, and create a Source API Key. That service must
   already have source retraction
   ([#47](https://github.com/NEARBuilders/activity.nearbuilders.org/pull/47)) deployed.
3. Set `ACTIVITY_GATEWAY_URL` (for example `https://activity.nearbuilders.org/api`) and
   `ACTIVITY_GATEWAY_API_KEY` in the deployment platform, and redeploy.
4. Switch the mode to `dual-write` and watch the status endpoint: `pending` should return to 0 and
   `failed` should stay 0. Check the events appear at `/api/v1/events?source=nearbuilders`.
5. Only after readers are migrated (issue #14) consider `standalone-only`.

## Rollback

Set the mode back to `legacy-only`. Legacy writes never stopped in `dual-write`, so nothing is
lost, and queued work stops being sent. To roll back from `standalone-only`, switch to
`dual-write` first so legacy rows resume, then to `legacy-only`; events published while in
`standalone-only` exist only in Activity, and the legacy table has a gap for that window.
Removing the gateway secrets also stops all forwarding at the next deploy.
