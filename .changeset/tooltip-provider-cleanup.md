---
"ui": patch
---

Remove the 12 route- and component-level `TooltipProvider` wrappers made redundant by the embedded default provider in `Tooltip` (apps routes, projects routes, activity, builders profile, profile activity, admin dashboard, data table, project tags, under-construction), and add a regression test asserting a bare `Tooltip` mounts without a provider.
