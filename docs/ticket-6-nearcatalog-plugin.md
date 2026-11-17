### Context
This is a child ticket of #23, to fetch and cache project data from NearCatalog (nearcatalog.xyz), the NEAR ecosystem project directory with 245+ projects and metadata (name, description, image, categories, URLs, GitHub repos). When builders claim they contributed to a catalog project (a claim flow handled in the API layer via `createCallbacks` in `api/src/index.ts`), we need a data source to look up and display project details. This plugin is read-only: fetch, cache, and serve catalog data.

### Overview
Create `plugins/nearcatalog` following the [every-plugin](https://tanstack.com/intent/registry/every-plugin) framework. You will need to implement a Drizzle cache table, oRPC contract (`listCatalogProjects`, `getCatalogProject`), and a service that fetches from the NearCatalog API, parses the response, and upserts into the cache. Wire into `api/src/contract.ts` as a public passthrough. Register in `bos.config.json`.

### Acceptance Criteria
- [ ] `plugins/nearcatalog` following every-plugin scaffold
- [ ] Drizzle schema (for cache): `catalog_projects` — `slug`, `title`, `description`, `imageUrl`, `categories` (text[]), `homepageUrl`, `repoUrl`, `llmsTxt` (nullable), `updated_at`
- [ ] oRPC contract:
  - `listCatalogProjects` — GET `/v1/nearcatalog/projects`, input `{ category?, search?, limit?, cursor? }`, output paginated
  - `getCatalogProject` — GET `/v1/nearcatalog/projects/{slug}`, input `{ slug }`, output project detail
- [ ] Service fetches from nearcatalog.xyz API, parses response, upserts into cache table
- [ ] Cache TTL: refresh on request if cache older than 1 hour
- [ ] API passthrough in `api/src/contract.ts`: both endpoints public
- [ ] Registered in `bos.config.json` with optional secret for catalog API URL
- [ ] `bos types gen` + `bun typecheck` passes
- [ ] Must follow everything-dev and every-plugin best practices
