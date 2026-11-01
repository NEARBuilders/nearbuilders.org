---
"ui": patch
---

Project detail pages (`/projects/<kind>/<slug>`) load faster: the route loader fetches the project once and then primes the vote count, your vote, collaborators, NEAR Social profile and organizations in parallel into the same query cache the page reads, so nothing is fetched twice. README and last-commit lookups to GitHub are cached for 10 minutes, don't retry, and no longer block the page; the README section shows its own skeleton while they load (#317).
