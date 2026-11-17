---
"ui": minor
"@everything-dev/projects-plugin": minor
---

Partner programs (#394–#398): a `project_programs` table in the projects plugin with public `listPrograms` (listed, open programs of active non-private projects, in admin `sortOrder`) and `getProjectPrograms` (a project's open and recently closed programs), plus admin-only `adminListPrograms`, `createProgram`, `updateProgram` and `reorderPrograms`. Open or closed is derived from `opensAt` / `closesAt` at read time. `/build` gets a "Partner programs" section (hidden when none are open) with a link in each program's topic section, project pages get a "Programs" block, and the admin dashboard gets a Programs tab with a NEAR AI credits template prefilled from the credits settings.
