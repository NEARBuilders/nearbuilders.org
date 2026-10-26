---
"api": minor
"ui": minor
"@everything-dev/builders-plugin": minor
"@everything-dev/projects-plugin": minor
---

Builders and projects can be tagged with their citynode.app community (#291).

- New optional `cityNode` field on builders and projects: the citynode.app community path, its slug for a top-level community (`chicago`) or parent slugs joined with `/` for a nested one (`illinois/chicago`), since child slugs are only unique within their parent. Send `null` to clear it.
- Slugs are checked against citynode.app's public node list, which the API caches (`GET /v1/city-nodes`, base URL from the `cityNodeUrl` variable, default https://citynode.app). Unknown slugs are rejected. If citynode.app can't be reached the cached list is used, and forms still save without a tag.
- `GET /v1/builders?cityNode=` and `GET /v1/projects?cityNode=` filter by community.
- The builder form (join and profile edit) and the project form get a city node picker showing the country / state / city levels. The city part of the builder's location suggests a matching city node, which the builder confirms.
- Builder and project pages show a chip linking to the community on citynode.app.
