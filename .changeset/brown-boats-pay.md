---
"ui": patch
---

Swap suspense queries for regular queries with loading/error fallback on builders page.

- **ui**: Replace `useSuspenseInfiniteQuery`/`useSuspenseQuery` with `useInfiniteQuery`/`useQuery` on the builders list page, adding a loading spinner and a graceful error state ("Unable to load builders") instead of relying on suspense boundaries.
