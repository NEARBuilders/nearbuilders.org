---
"ui": patch
"@everything-dev/projects-plugin": patch
---

The projects list loads more entries as you scroll, like the builders list. Newest is now the default sort, so the default view shows the first page right away instead of fetching every entry to rank them. Most endorsed is still available and still loads everything before ranking. The projects API orders ties by id so cursor pages never skip or repeat a row, and entries repeated across pages are shown once. Changing a filter, tab or sort starts a fresh list. If a later page fails to load, the entries already shown stay on screen with a retry button instead of the whole list turning into an error.
