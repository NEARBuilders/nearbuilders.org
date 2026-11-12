---
"@everything-dev/projects-plugin": minor
---

Status checks (#412, part 1): `project_status_checks` and `project_status_results` tables (cascade from projects), a background poller that checks listed checks every 5 minutes (10 s timeout, capped body, https and public addresses only, re-checked on every connection) and keeps 7 days of history, health-body mapping to up / degraded / down with public reason codes, and admin-only `adminListStatusChecks`, `createStatusCheck`, `updateStatusCheck`, `deleteStatusCheck`, `runStatusCheck` and `seedStatusChecks`.
