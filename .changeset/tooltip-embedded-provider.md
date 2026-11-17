---
"ui": patch
---

Embed a default `TooltipProvider` inside `Tooltip` so tooltips no longer throw "Tooltip must be used within TooltipProvider" when rendered outside an explicit provider. Fixes the /dashboard crash triggered by activity-ineligible project rows.
