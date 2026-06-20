---
"api": patch
"@everything-dev/projects-plugin": patch
---

Add error logging and database connection verification for better observability.

- **api**: Wrap project handler calls (`listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, etc.) in try/catch blocks with `console.error` logging for improved debuggability.
- **projects plugin**: Verify database connectivity on startup by issuing `SELECT 1` before running migrations; add `console.error` logging to all Effect exit failures for easier debugging of production issues.
