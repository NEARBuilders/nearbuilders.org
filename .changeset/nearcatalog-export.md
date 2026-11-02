---
"api": minor
"@everything-dev/nearcatalog-plugin": minor
---

Public NEAR Catalog export of approved records (#289).

- `GET /v1/nearcatalog/export/projects` returns approved projects with NEAR Catalog's submit-form field names (`title`, `oneliner`, `description`, `logo`, `categories`, the link fields, `token-address`, `coingecko-address`, `nearsocial-address`) plus `slug`, `dapp`, `phase` and `source`.
- `GET /v1/nearcatalog/export/people` returns approved builders in the `people-on-near.json` shape plus `nearAccount`. `nearProjects` lists the person's approved projects.
- Only records a human admin approved are exported. Pending, rejected, withdrawn and private records never are, and records with fields outside NEAR Catalog's format are dropped.
- `?since=` returns only records that changed after that time, and lists withdrawn or rejected records under `removed` so they can be delisted.
- The email field only ever carries the builder's public email. The near.social avatar goes through the IPFS gateway as a stable URL.
