---
"@everything-dev/nearcatalog-plugin": minor
"api": minor
---

Add the NEAR Catalog project adapter and reviewed contribution claim foundation (#52).

- **nearcatalog plugin**: Normalize active projects from the NEAR Catalog API, persist one active claim per builder and project with multiple roles, and expose public reads plus admin-only claim lifecycle operations.
- **api**: Expose public project search, project detail, claim listing, and claimed-project aggregation routes backed by the NEAR Catalog plugin.
