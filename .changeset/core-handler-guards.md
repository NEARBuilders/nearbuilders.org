---
"api": patch
"@everything-dev/activity-plugin": patch
"@everything-dev/events-plugin": patch
"@everything-dev/projects-plugin": patch
---

Apply the core API's creation rules inside the plugins too, so every entry point behaves the same.

- Activity registration starts only through the core project handler, which checks the project first.
- Creating a project or event requires a linked NEAR account for non-admins, and new content stays private unless the core API allows public (approval off) or an admin approved it.
- Members can't switch an event to public by editing it; that still goes through review.
- Creating a project with an id that already belongs to someone else is refused.
