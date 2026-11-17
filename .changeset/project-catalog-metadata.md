---
"api": minor
"ui": minor
"@everything-dev/projects-plugin": minor
"@everything-dev/nearcatalog-plugin": minor
---

Projects can carry the details NEAR Catalog lists for a project (#286).

- Projects get an optional `catalog` field: tagline (up to 140 characters), up to 6 NEAR Catalog categories, phase, links (X, Telegram, Discord, Medium, whitepaper, NEAR Social, LinkedIn, YouTube), token contract and CoinGecko id.
- Categories are NEAR Catalog's own slugs. `GET /v1/nearcatalog/categories` returns the live list, cached for an hour, with a checked-in fallback, and the API rejects unknown categories.
- The project form has a NEAR Catalog section with a readiness checklist (tagline, description, logo, at least one category). The project page shows the tagline, categories, phase and links, and tells owners and collaborators what is still missing.
- Catalog details travel with project review proposals, so an approved project keeps them.
