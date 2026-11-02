---
"api": minor
"ui": minor
"@everything-dev/nearcatalog-plugin": minor
---

"On NEAR Catalog" badge (#292).

- Project cards, builder cards, project pages and builder profiles show an "On NEAR Catalog" badge once a NEAR Builders admin approved the record for NEAR Catalog. Its tooltip says what it means.
- Once a listing is marked as published on NEAR Catalog, the badge on project pages links to the NEAR Catalog page.
- The badge is separate from the existing "Catalog" badge, which still marks projects imported from NEAR Catalog.
- New public `GET /v1/nearcatalog/listings?kind=` returns approved and published listings, and admins can mark a listing as published with `POST /v1/nearcatalog/listings/published`.
