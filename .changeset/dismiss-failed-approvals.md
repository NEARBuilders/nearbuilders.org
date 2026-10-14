---
"api": minor
"@everything-dev/proposals-plugin": minor
"@everything-dev/builders-plugin": patch
---

Let admins dismiss approvals that failed to publish, and accept every country as a builder location.

- Approved proposals whose publishing failed (or stalled) can now be dismissed from the review sheet's new **Dismiss** button, or from Chief with the `dismiss` decision on `POST /reviews/telegram-decision`. Nothing was published, so nothing is removed: the record moves to Rejected with an optional note, gets a `failure_dismissed` audit entry, leaves the failed queue and the digest, and can be reopened. The submitter is not notified. New routes: `POST /proposals/{pluginId}/{entityId}/dismiss` (admin) and the proposals plugin's `dismissFailure`.
- Builder locations accept all countries instead of a 33-country shortlist, so approvals such as "Iraq" no longer fail to publish. Matching also ignores accents and accepts common alternate names (Türkiye, Ivory Coast, Czech Republic, Holland, Viet Nam and others).
