---
"ui": patch
---

Builder profile pages (`/builders/<account>`) load faster: the route loader now fetches the builder, proposals, NEAR profile, stats, projects, team projects, claimed catalog projects and activity feed in one parallel dispatch (vote lookups follow as soon as proposals arrive), and the page reads the same query cache so nothing the loader loaded is fetched again (#316).
