<!-- intent-skills:start -->
# TanStack Intent - before editing files, run the matching guidance command.
tanstackIntent:
  - id: "@hot-labs/near-connect#near-connect-quickstart"
    run: "pnpm dlx @tanstack/intent@latest load @hot-labs/near-connect#near-connect-quickstart"
    for: "Install and set up @hot-labs/near-connect for NEAR blockchain wallet connection. Covers NearConnector initialization, connect/disconnect, wallet:signIn and wallet:signOut events, feature filtering, WalletConnect configuration, and manifest auto-updating. Use when adding NEAR wallet support to a dapp, configuring WalletConnect for mobile wallets, or troubleshooting wallet visibility issues."
  - id: "@hot-labs/near-connect#near-connect-transactions"
    run: "pnpm dlx @tanstack/intent@latest load @hot-labs/near-connect#near-connect-transactions"
    for: "Send transactions and sign messages with @hot-labs/near-connect. Covers ConnectorAction format (FunctionCall, Transfer, etc.), @near-js Action compatibility, signAndSendTransaction, signAndSendTransactions, signMessage, signInAndSignMessage, signDelegateActions, and function call access key parameters. Use when a dapp needs to call a NEAR contract, sign a message for authentication, or add a limited-access key."
  - id: "@tanstack/devtools#devtools-app-setup"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-app-setup"
    for: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
  - id: "@tanstack/devtools#devtools-marketplace"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-marketplace"
    for: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
  - id: "@tanstack/devtools#devtools-plugin-panel"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-plugin-panel"
    for: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
  - id: "@tanstack/devtools#devtools-production"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools#devtools-production"
    for: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
  - id: "@tanstack/devtools-event-client#devtools-bidirectional"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-bidirectional"
    for: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
  - id: "@tanstack/devtools-event-client#devtools-event-client"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-event-client"
    for: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
  - id: "@tanstack/devtools-event-client#devtools-instrumentation"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-instrumentation"
    for: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
  - id: "@tanstack/react-table#create-table-hook"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#create-table-hook"
    for: "Build reusable React table infrastructure with createTableHook, useAppTable, createAppColumnHelper, shared features/defaults, component registries, AppTable/AppCell/AppHeader wrappers, and typed context hooks. Load for recurring application table conventions, scoped contexts, HMR cycles, or table prop drilling."
  - id: "@tanstack/react-table#getting-started"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#getting-started"
    for: "Create and render a TanStack React Table v9 table with useTable, tableFeatures, stable data and columns, row/header models, and table.FlexRender. Load for a first React table, headless rendering, or when v8 useReactTable examples are producing the wrong setup."
  - id: "@tanstack/react-table#migrate-v8-to-v9"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#migrate-v8-to-v9"
    for: "Perform a complete @tanstack/react-table v8-to-v9 migration: hook and feature architecture, row-model slots, React state and subscriptions, rendering, composable tables, type helpers, and every shared API rename and semantic change. Use for migration plans, implementation, or audits. Treat useLegacyTable only as a deprecated temporary bridge."
  - id: "@tanstack/react-table#table-state"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#table-state"
    for: "Read, select, subscribe to, and control React Table V9 state with useTable selectors, table.state, table.Subscribe, table.atoms, table.store, and external TanStack Store atoms. Load for controlled state, render performance, or React Compiler builder-method subscription problems."
  - id: "@tanstack/react-table#with-tanstack-query"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#with-tanstack-query"
    for: "Compose React Table v9 with TanStack Query for server filtering, sorting, pagination, and infinite data. Load for query-key table state, manual* processing boundaries, server rowCount, keepPreviousData, or avoiding duplicated query-result state."
  - id: "@tanstack/react-table#with-tanstack-virtual"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#with-tanstack-virtual"
    for: "Virtualize final React Table row or column models with TanStack Virtual. Load for useVirtualizer counts, scroll elements, stable keys, data-index measurement, dynamic heights, sticky headers/columns, grid/flex geometry, or infinite fetching; Virtual is renderer composition, not a Table feature."
  - id: "@tanstack/router-core#router-core"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core"
    for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
  - id: "@tanstack/router-core#router-core/auth-and-guards"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/auth-and-guards"
    for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
  - id: "@tanstack/router-core#router-core/code-splitting"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/code-splitting"
    for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
  - id: "@tanstack/router-core#router-core/data-loading"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/data-loading"
    for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
  - id: "@tanstack/router-core#router-core/navigation"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation"
    for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
  - id: "@tanstack/router-core#router-core/not-found-and-errors"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/not-found-and-errors"
    for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
  - id: "@tanstack/router-core#router-core/path-params"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/path-params"
    for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
  - id: "@tanstack/router-core#router-core/search-params"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/search-params"
    for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
  - id: "@tanstack/router-core#router-core/ssr"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/ssr"
    for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
  - id: "@tanstack/router-core#router-core/type-safety"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/type-safety"
    for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
  - id: "@tanstack/router-plugin#router-plugin"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-plugin#router-plugin"
    for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
  - id: "@tanstack/table-core#aggregation"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#aggregation"
    for: "Aggregate TanStack Table columns independently of grouping, including grand totals, caller-selected row totals, multiple keyed aggregations, custom context-based definitions, grouped merges, manual values, and worker constraints."
  - id: "@tanstack/table-core#api-not-found"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#api-not-found"
    for: "Diagnose missing TanStack Table v9 exports, options, state slices, and instance methods. Load before inventing an API when code sees a type error, undefined feature method, absent object key, adapter mismatch, or v8-shaped example."
  - id: "@tanstack/table-core#cell-selection"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#cell-selection"
    for: "Select, add, and subtract rectangular cell ranges with cellSelectionFeature: ordered include/exclude operations keyed by row and column id, modifier dragging, final positive bounds, selection edges, render-order resolution under pinning, and autoResetCellSelection. Load for spreadsheet-style selection, “select all except” behavior, unexpected range changes after sorting or reordering, drag performance, or copy-to-clipboard."
  - id: "@tanstack/table-core#cell-spanning"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#cell-spanning"
    for: "Merge adjacent body cells with cellSpanningFeature: value-based rowSpan opt-in per column via spanRows, per-row colSpan via spanColumns, and the covered-cell convention where a span of 0 means skip the cell. Load for merged data grids, spans that disappear after sorting or paginating, ragged table rows, or a cell that unexpectedly merges down the whole tbody."
  - id: "@tanstack/table-core#client-vs-server"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#client-vs-server"
    for: "Choose client or server ownership for filtering, grouping, sorting, expanding, and pagination in TanStack Table v9. Load for manual* flags, mixed pipelines, server counts, or deciding which dataset each row-model stage receives."
  - id: "@tanstack/table-core#column-faceting"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#column-faceting"
    for: "Build faceted filter UIs with columnFacetingFeature, facetedRowModel, facetedUniqueValues, and facetedMinMaxValues. Load for facet counts, numeric ranges, own-filter exclusion, or server-page facet completeness."
  - id: "@tanstack/table-core#column-filtering"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#column-filtering"
    for: "Filter columns with columnFilteringFeature, filteredRowModel, filterFns, filterMeta, nested-row direction, and manualFiltering. Load for accessor compatibility, controlled filter updaters, fuzzy metadata, or client/server ownership."
  - id: "@tanstack/table-core#column-ordering"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#column-ordering"
    for: "Control TanStack Table v9 leaf columnOrder with stable IDs while accounting for pinning regions, visibility, and groupedColumnMode precedence. Load for drag-and-drop columns or rendered order that differs from state."
  - id: "@tanstack/table-core#column-pinning"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#column-pinning"
    for: "Pin columns into logical start, center, and end regions with columnPinningFeature and renderer-owned sticky CSS. Load for RTL offsets, z-index, backgrounds, overflow, widths, gaps, or overlaps."
  - id: "@tanstack/table-core#column-resizing"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#column-resizing"
    for: "Wire columnResizingFeature, header.getResizeHandler, resize mode and direction, pointer or touch events, and performant CSS-variable updates. Load when resize state changes but widths do not, or large tables resize slowly."
  - id: "@tanstack/table-core#column-sizing"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#column-sizing"
    for: "Use columnSizingFeature numeric size, minSize, maxSize, getSize, getStart, getAfter, and total-size APIs in table, grid, or flex CSS. Load for auto or percentage misconceptions and sizing/pinning layout mismatch."
  - id: "@tanstack/table-core#column-visibility"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#column-visibility"
    for: "Hide columns with columnVisibilityFeature while rendering visibility-aware header, column, and cell collections. Load when hidden columns remain in the DOM, false-versus-absent state is confused, or enableHiding is misunderstood."
  - id: "@tanstack/table-core#core"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#core"
    for: "Use TanStack Table v9 as a headless data-grid state and row-processing engine. Load for first-table architecture, stable data and columns, row numbering with getDisplayIndex, semantic rendering, framework adapter choice, or deciding what Table owns versus the renderer."
  - id: "@tanstack/table-core#custom-features"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#custom-features"
    for: "Author a TanStack Table v9 feature plugin across every FeatureMap and API installation surface: state, options, column definitions, table, column, row, cell, header, row-model functions/caches, defaults, prototypes, and table/row/column instance data lifecycles. Load for initTableInstanceData, resetTableInstanceData, constructTableAPIs, or reusable behavior not covered by built-ins, meta, or option composition."
  - id: "@tanstack/table-core#expanding"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#expanding"
    for: "Expand hierarchical subrows or custom detail panels with rowExpandingFeature, expandedRowModel, getSubRows, getRowCanExpand, manualExpanding, and paginateExpandedRows. Load when expansion state changes but no UI appears."
  - id: "@tanstack/table-core#global-filtering"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#global-filtering"
    for: "Apply globalFilter across eligible columns with globalFilteringFeature, columnFilteringFeature, filteredRowModel, globalFilterFn, and manual server filtering. Load when columns unexpectedly participate or a global filter changes state without changing rows."
  - id: "@tanstack/table-core#grouping"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#grouping"
    for: "Group rows with columnGroupingFeature, groupedRowModel, groupedColumnMode, and manualGrouping. Load for grouped or placeholder cells and grouping interactions with expansion or pagination."
  - id: "@tanstack/table-core#migrate-v8-to-v9"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#migrate-v8-to-v9"
    for: "Perform a complete TanStack Table v8-to-v9 migration audit: feature registration, row-model and function-registry slots, state/store changes, prototype methods, column pinning and resizing renames, sorting and selection semantics, removed internals, helpers, meta typing, and generic changes. Load this shared inventory before the installed framework adapter's migration skill."
  - id: "@tanstack/table-core#pagination"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#pagination"
    for: "Paginate with rowPaginationFeature and paginatedRowModel or manualPagination. Load for pageIndex/pageSize state, rowCount/pageCount, unknown next-page limits, already-paginated server data, or autoResetPageIndex surprises."
  - id: "@tanstack/table-core#row-pinning"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#row-pinning"
    for: "Pin stable row IDs into top, center, and bottom collections with rowPinningFeature and keepPinnedRows. Load for filtering/pagination visibility, explicit region rendering, or renderer-owned sticky CSS."
  - id: "@tanstack/table-core#row-selection"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#row-selection"
    for: "Maintain rowSelection ID state with stable getRowId, single, multi, subrow, and Shift-range rules, selected row models, handler anchors, and manual-pagination semantics. Load when implementing getToggleSelectedHandler, enableRowRangeSelection, selectChildren, deselectParents, or selected IDs that outlive loaded Row objects."
  - id: "@tanstack/table-core#sorting"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#sorting"
    for: "Sort with rowSortingFeature, sortedRowModel, sortFns, multi-sort and removal options, sortUndefined, and manualSorting. Load for comparator direction, incoming server order, or product-specific sorting cycles."
  - id: "@tanstack/table-core#table-features"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#table-features"
    for: "Register TanStack Table v9 tableFeatures, feature plugins, create*RowModel factories, and function registries in prerequisite order. Load when an option, state slice, or instance API is missing, or when choosing explicit features versus stockFeatures."
  - id: "@tanstack/table-core#typescript"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/table-core#typescript"
    for: "Preserve TanStack Table v9 inference with createColumnHelper, columns(), tableOptions, tableFeatures, and metaHelper. Load for ColumnDef errors, reusable tables, typed meta, named registries, or unnecessary manual feature generics."
  - id: "@tanstack/virtual-file-routes#virtual-file-routes"
    run: "pnpm dlx @tanstack/intent@latest load @tanstack/virtual-file-routes#virtual-file-routes"
    for: "Programmatic route tree building as an alternative to filesystem conventions: rootRoute, index, route, layout, physical, defineVirtualSubtreeConfig. Use with TanStack Router plugin's virtualRouteConfig option."
  - id: "better-near-auth#auth-plugin"
    run: "pnpm dlx @tanstack/intent@latest load better-near-auth#auth-plugin"
    for: "Mount and consume the @everything-dev/auth-plugin in an everything-dev or every-plugin project. Register it in bos.config.json, wire the Better Auth client into the UI with siwnClient/passkey/API-key/organization plugins, protect routes with session checks, compose with the auth plugin in-process via createPlugin.withPlugins, and use the auth context (getContext) in your own oRPC middleware. Sub-account creation is supported in bos.config.json for scalar fields (parentHasFullAccess, minDeposit, deploy.fromPublished, init with static args). Load when adding auth to an everything.dev app, configuring SIWN recipients from runtime config, calling auth endpoints from another plugin, or debugging auth context resolution. As of better-near-auth 1.8.2 the client uses getNearClient() (not .client) and signIn.near / near.link refresh the session atomically."
  - id: "better-near-auth#client"
    run: "pnpm dlx @tanstack/intent@latest load better-near-auth#client"
    for: "Set up the siwnClient plugin for Better Auth client, configure NEAR wallet connection via NearConnect, use authClient.near actions for sign-in, profile lookup, account management, delegate action building with TransactionBuilder, and relay submission. Load when implementing NEAR wallet sign-in on the client, using authClient.near.* methods, or building delegate actions for gasless relay."
  - id: "better-near-auth#relay"
    run: "pnpm dlx @tanstack/intent@latest load better-near-auth#relay"
    for: "Configure the gasless NEP-366 delegate action relayer in ephemeral or explicit mode, relay signed delegate actions on-chain, enforce contract whitelisting and gas/deposit limits, check relay status and history, and use the contract view endpoint. Load when setting up relayer config or debugging relay failures."
  - id: "better-near-auth#siwn"
    run: "pnpm dlx @tanstack/intent@latest load better-near-auth#siwn"
    for: "Set up the SIWN server plugin for Better Auth, configure NEP-413 authentication with recipient and API key, handle nonce generation, signature verification, account linking and unlinking, and NEAR profile lookup. Load when adding NEAR wallet sign-in to a Better Auth server, configuring siwn() plugin options, or debugging NEP-413 verify or nonce issues."
  - id: "better-near-auth#subaccount"
    run: "pnpm dlx @tanstack/intent@latest load better-near-auth#subaccount"
    for: "Configure sub-account creation with parent ownership, contract deployment, init calls, composable transaction hooks, and lifecycle callbacks with automatic rollback. Load when setting up subAccount config, deploying contracts to new sub-accounts, or handling post-creation side effects. Sub-account creation surface has been stable since 1.7.0; the 1.8.x client improvements (getNearClient, detectNearAccount, session-signal notify) do not change the createSubAccount / checkSubAccountAvailability endpoints."
  - id: "better-near-auth#tanstack"
    run: "pnpm dlx @tanstack/intent@latest load better-near-auth#tanstack"
    for: "Integrate better-near-auth with TanStack Router (SSR or CSR). Set up auth client as a router context singleton, useAuthClient hook, session query options, inferred types from AuthClient, and ensureConnected before signing. Load when scaffolding a new TanStack Router app with better-near-auth, wiring auth into router context, or debugging wallet state loss after sign-in in SSR/CSR TanStack apps."
  - id: "dotenv#dotenv"
    run: "pnpm dlx @tanstack/intent@latest load dotenv#dotenv"
    for: "Load environment variables from a .env file into process.env for Node.js applications. Use when configuring apps with secrets, setting up local development environments, managing API keys and database uRLs, parsing .env file contents, or populating environment variables programmatically. Always use this skill when the user mentions .env, even for simple tasks like \"set up dotenv\" — the skill contains critical gotchas (encrypted keys, variable expansion, command substitution) that prevent common production issues."
  - id: "dotenv#dotenvx"
    run: "pnpm dlx @tanstack/intent@latest load dotenv#dotenvx"
    for: "Use dotenvx to run commands with environment variables, manage multiple .env files, expand variables, and encrypt env files for safe commits and CI/CD."
  - id: "every-plugin#plugin-client"
    run: "pnpm dlx @tanstack/intent@latest load every-plugin#plugin-client"
    for: "Connect to and consume deployed everything.dev plugins from an external app, child project, or script. Use when creating API/auth clients, reading runtime config, authenticating with API keys or sessions, or calling plugin routes programmatically."
  - id: "every-plugin#plugin-development"
    run: "pnpm dlx @tanstack/intent@latest load every-plugin#plugin-development"
    for: "Build every-plugin modules with oRPC contracts, Effect services, and Module Federation. Use when creating or modifying plugins under plugins/ or the _template scaffold."
  - id: "every-plugin#plugin-testing"
    run: "pnpm dlx @tanstack/intent@latest load every-plugin#plugin-testing"
    for: "Test every-plugin modules with vitest and the plugin runtime. Use when writing or modifying plugin tests under plugins/*/src/__tests__/ or plugins/*/tests/."
  - id: "everything-dev#add-a-route"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#add-a-route"
    for: "Add one API endpoint end to end in everything.dev — contract route with Zod schemas, Effect-native handler in the plugin router, UI call via useApiClient, route file rendering the data, typecheck, publish. Use when adding an API endpoint, wiring a new UI page to app data, or debugging the contract/handler/client chain."
  - id: "everything-dev#api-and-auth"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#api-and-auth"
    for: "API architecture, oRPC contracts, auth middleware, plugin-client composition, session handling, and client-side auth. Use when adding API routes, creating middleware, calling other plugins in-process, or integrating auth in routes and UI."
  - id: "everything-dev#cli-reference"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#cli-reference"
    for: "Quick reference for all bos CLI commands — flags, options, environment settings, and links to detailed guidance in related skills. Use when any bos command comes up or the user needs a CLI overview."
  - id: "everything-dev#code-style"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#code-style"
    for: "Code style conventions for everything-dev projects — component file naming (kebab-case, lowercase), CSS (semantic Tailwind only, no hardcoded colors), no comments in implementation, import/export conventions, and following neighboring file patterns."
  - id: "everything-dev#dev-workflow"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#dev-workflow"
    for: "Development workflow for everything-dev projects using bos dev, bos start, and the Module Federation runtime. Use when starting dev servers, debugging hot reload, or understanding the service-descriptor architecture."
  - id: "everything-dev#extends-config"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#extends-config"
    for: "How bos.config.json extends chains work, deep merge semantics, resolved config lifecycle, env-specific extends, and canonical field ordering. Use when debugging extends inheritance, configuring per-environment parents, understanding what dev writes vs publish writes, or reasoning about config merging."
  - id: "everything-dev#init-upgrade"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#init-upgrade"
    for: "bos init, bos sync, and bos upgrade workflows — template download, snapshot-based conflict detection, package version bumps, and how init/sync select and own files. Use when scaffolding new projects, syncing upstream changes, or upgrading framework packages."
  - id: "everything-dev#plugin-development"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#plugin-development"
    for: "Build, register, and deploy plugins within everything.dev. Covers the _template scaffold, contract/service/index pattern, database setup with Drizzle, bos.config.json registration, plugin UI/sidebar, and CLI workflow. Use when creating new plugins, adding database-backed routes, or deploying plugins to production."
  - id: "everything-dev#publish-sync"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#publish-sync"
    for: "Publish bos.config.json to the FastKV registry, sync from upstream, and upgrade workspace packages. Use when deploying, syncing, or managing runtime configuration across projects."
  - id: "everything-dev#registry"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#registry"
    for: "Read and write the FastKV config registry efficiently — key layout, namespace=signer semantics, integrity, and composing published runtimes into local bos.config.json. Use when publishing configs, composing another runtime's UI/host/api/plugins, or debugging why a published config doesn't resolve."
  - id: "everything-dev#super-app"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#super-app"
    for: "Build shared-host, shared-API super apps with tenant-specific UI composition. Use when setting up a base runtime plus custom tenant apps, configuring fixed-core multi-tenancy, reasoning about extends-based runtime lineage, or deciding what tenants can override today."
  - id: "everything-dev#talk-to-the-app"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#talk-to-the-app"
    for: "Work a running everything.dev app over its API without cloning it — MCP tools, REST/OpenAPI, oRPC RPC, plugin RPC, API-key authentication, and discovery endpoints. Use when an agent needs to read or write app data (registry, proposals, votes, auth session, AI chat) over HTTP, choose between MCP/REST/RPC surfaces, or debug authentication and refused calls."
  - id: "everything-dev#ui-integration"
    run: "pnpm dlx @tanstack/intent@latest load everything-dev#ui-integration"
    for: "Route creation, API client usage, auth client, SSR hydration, sidebar system, and the @/app module surface. Use when adding new UI routes, fetching data from the API, implementing auth flows, or customizing sidebar navigation."
<!-- intent-skills:end -->

# Agent Instructions

This document provides operational guidance for AI agents working in this everything.dev project.

## Quick Reference

**Never use bun.** CI fails on any `bun.lock` artifact — bun re-migrates the workspace (framework ADR 0026, see https://github.com/NEARBuilders/everything-dev). Run package managers and executables as `pnpm …` / `pnpm exec …`.

**Start Development:**
```bash
pnpm install
pnpm run dev
```

**Check Status:**
```bash
bos ps        # List running processes
bos status    # Project health check
bos info      # Show configuration
```

**Deploy:**

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/everything-dev-template?referralCode=MuB_vg&utm_medium=integration&utm_source=template&utm_campaign=generic)

The Railway template deploys the everything.dev Docker image. Set these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `BOS_ACCOUNT` | The NEAR account that owns this app's published configuration on-chain | `myapp.near` |
| `BOS_GATEWAY` | The core domain where this app is served | `myapp.com` |
| `BETTER_AUTH_SECRET` | Secret for session encryption — generate with `openssl rand -base64 32` | (random) |

**Self-deployed production:**

You don't need to wait for a PR to merge and run through CI/CD. Publish your own config on-chain under your own NEAR account and run your own host instance, inheriting the base platform via `extends`.

1. **Install near-cli-rs** (the `bos` CLI shells out to it for `bos publish` and `bos login --key`):
   ```bash
   curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/download/v0.23.5/near-cli-rs-installer.sh | sh
   ```
2. **Create a NEAR account** (testnet or mainnet). Named accounts can own subaccounts; implicit hex accounts cannot:
   ```bash
   near account create-account fund-my-account <your-account>.testnet use-faucet network-config testnet
   ```
3. **Generate a publish key** — a function-call key scoped to the FastKV registry contract:
   ```bash
   bos login --key
   ```
   The key is exported to the near-cli-rs keystore; set `NEAR_PRIVATE_KEY` in `.env` or CI secrets when running non-interactively.
4. **Update `bos.app.ts`** — set `account` to your NEAR account, add `extends` to inherit the base platform, keep `domain` as the gateway:
   ```ts
   { "extends": "bos://<parent-account>/<parent-gateway>", "account": "<your-account>.near", "domain": "<parent-gateway>" }
   ```
 5. **Publish and deploy:**
    ```bash
    bos deploy           # preflight → build → upload bundles → publish config to FastKV at bos://<your-account>/<gateway> → image/Railway when configured
    ```
6. **Deploy to Railway** (one-click template or `railway up`), set `BOS_ACCOUNT`, `BOS_GATEWAY` (same gateway as parent), and `BETTER_AUTH_SECRET`. Your Railway host fetches your config from FastKV and serves live.

`BOS_GATEWAY` is the **FastKV lookup key**, not the DNS domain your Railway instance serves on. By keeping the same gateway while using your own `BOS_ACCOUNT`, your config lives at a separate FastKV path that `extends` the base runtime — you inherit the full platform and override only what you change.

**Tenant creation** (for the admin wizard) is DAO-owned: connect a sputnik-dao account via the Trezu wallet in the admin wizard; the wizard publishes the tenant runtime config under `bos://<dao-account>/<gateway>`. No server-side subaccount keys are needed.

## Architecture

This is an everything.dev child project. Depending on your overrides, it may include:
- **UI** — React 19 + TanStack Router frontend, loaded via Module Federation
- **API** — Hono.js + oRPC backend with Effect services
- **Plugins** — Self-contained business logic modules with oRPC contracts

The parent runtime provides the shared framework; your project provides custom overrides.

## Development Workflow

### Starting Development
1. `pnpm install`
2. `pnpm run dev`
3. `bos dev` creates `.env` on first run and starts local Postgres via docker compose when it is down

### Debugging Issues

**API not responding:**
- Check `bos ps` to see if the API process is running
- Check `.bos/logs/api.log` for errors

**UI not loading:**
- Verify the dev server is running: `bos ps`
- Check browser console for Module Federation errors
- Clear browser cache and retry

**Type errors:**
- Run `pnpm run typecheck`

## Code Changes

### Making Changes
- **UI Changes**: Edit `ui/src/` files → hot reload automatically
- **API Changes**: Edit `api/src/` files → hot reload automatically
- **New Components**: Create in `ui/src/components/ui/`, export from `ui/src/components/index.ts`
- **New Routes**: Create file in `ui/src/routes/`, TanStack Router auto-generates tree

### Style Requirements
- Use semantic Tailwind classes: `bg-background`, `text-foreground`, `text-muted-foreground`
- No hardcoded colors like `bg-blue-600`
- No code comments in implementation
- Component file naming: lowercase kebab-case (`data-table.tsx`, `user-profile.tsx`)
- Follow existing patterns in neighboring files

Review-time rules — the write-once goal, type-safety patterns, the workaround protocol, and the comment `KEEP`/`TODO` conventions — are in [`docs/agents/coding-standards.md`](docs/agents/coding-standards.md).

### Framework-owned files and the upstream-change protocol (ADR 0032)

The files carrying the `FRAMEWORK-OWNED` header (build configs, db/lib plumbing, workflows) are reconciled from the parent template by `bos upgrade`: template wins on the next upgrade, local copies are backed up under `.bos/sync-backup/`, and **same-version upgrades never touch them** (only the framework version change reconciles them).

**Editing them is allowed.** When the work needs it, edit a framework-owned file, keep the build/typecheck/tests green — then **file an accompanying issue at https://github.com/NEARBuilders/everything-dev/issues** describing the change so it gets implemented in the framework and shipped in package versions. A local edit without an upstream issue is an undocumented fork that the next upgrade will quietly clobber.

When the need is a **bug**, a **missing capability**, or a **pattern improvement**, follow [`docs/agents/change-placement.md`](docs/agents/change-placement.md) — including its first rule: sync-owned files are a contribution channel, not a fence. A human-facing diagram tour of the whole runtime lives in [`docs/agents/how-it-fits.md`](docs/agents/how-it-fits.md); `/teach` builds lessons from it.

### Adding API Endpoints
1. Define in `api/src/contract.ts` — the oRPC route definitions and Zod schemas
2. Implement in `api/src/index.ts` — the `createRouter` function
3. Use in UI via `apiClient` from `useApiClient()` in `@/app`

### Plugin Architecture

Business logic is organized into independent plugins loaded via Module Federation:
- Each plugin has its own `contract.ts` — oRPC route definitions and Zod schemas
- Each plugin has its own `index.ts` — `createPlugin` with variables, secrets, context, router
- Each plugin has its own rspack config for independent deployment

The UI accesses plugin routes via namespaced clients: `apiClient.<plugin>.<method>()`.

### Plugin Client (pluginsClient)

The API plugin receives typed client factories for all other plugins via `createPlugin.withPlugins<PluginsClient>()`, enabling in-process composition without HTTP roundtrips.

### Generated Types

`api/src/lib/plugins-types.gen.ts`, `api/src/lib/auth-types.gen.ts`, `ui/src/lib/api-types.gen.ts`, and `ui/src/lib/auth-types.gen.ts` are generated by `bos types gen` from `bos.app.ts`. These files are gitignored and auto-regenerated on `pnpm install`, `typecheck`, `bos dev`, `bos build`, and bos plugin management commands.

If you hand-edit `bos.app.ts`, run `bos types gen` or restart `bos dev` to regenerate.

## Testing & Quality

**Before committing:**
```bash
pnpm run test    # Run all tests
pnpm run typecheck   # Type check all packages
pnpm run lint        # Run linting
```

When to write a test, which layer, what the parent framework covers vs what
this repo must cover: [`docs/agents/testing.md`](docs/agents/testing.md).

## Common Patterns

### Authentication Check

Routes requiring auth use `_authenticated.tsx` layout:
```typescript
export const Route = createFileRoute('/_layout/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session?.user) {
      throw redirect({ to: '/login', search: { redirect: location.pathname } });
    }
  },
});
```

### API Client Usage
```typescript
import { useApiClient } from "@/app";

function MyComponent() {
  const apiClient = useApiClient();
  const { data } = await apiClient.ping();
}
```

## Workflow Skills

This repo ships agent workflow skills in `.agents/skills/` — the ordered development flow (grill → spec → tickets → implement/tdd → code-review). Start `/everything-dev-app` to orient and pick the right next step; `/ask-matt` is the router if unsure.

- `/grill-with-docs` — sharpen an idea by interview, leaving a paper trail in `GLOSSARY.md` and ADRs
- `/to-spec` / `/to-tickets` — turn a plan into a spec, then tracer-bullet tickets under `.scratch/<feature>/issues/`
- `/implement` + `/tdd` — build a ticket test-first at pre-agreed seams
- `/code-review` — two-axis review (Standards + Spec) of the diff since a fixed point
- `/diagnosing-bugs` — diagnosis loop for hard bugs and performance regressions

Run `/setup-matt-pocock-skills` once before first use. Tracker and triage conventions live in `docs/agents/`.

## Agent Communication Surface

The host exposes several surfaces for programmatic agent access:

| Surface | Endpoint | Auth | Use |
|---------|----------|------|-----|
| MCP | `POST /api/mcp` | `x-api-key` header or session cookie | MCP clients — auto-generated tools from OpenAPI spec, stateless Streamable HTTP transport |
| REST/OpenAPI | `GET/POST/... /api/{path}` | `x-api-key` header or session cookie | Standard REST; Scalar docs at `GET /api`, spec at `GET /api/spec.json` |
| oRPC RPC | `POST /api/rpc/{procedure}` | `x-api-key` header or session cookie | Typed JSON-RPC for all API procedures |
| Plugin RPC | `POST /api/rpc/{plugin}/{procedure}` | `x-api-key` header or session cookie | Per-plugin RPC (e.g. `/api/rpc/auth/getSession`) |
| MCP discovery | `GET /.well-known/mcp.json` | None | JSON descriptor with server name, endpoint, and auth scheme |

### Authentication for agents

Every surface requires a session or API key — anonymous requests get `401` (including MCP `tools/list`).

1. Sign in with your NEAR wallet (SIWN) at the website — or run `bos login` from a machine with a browser.
2. Navigate to **Settings → API Keys** at `/settings/api-keys`.
3. Create a new key — the full secret (`api_...`) is shown once. Copy it immediately.
4. Pass it on every request: `x-api-key: api_your_key_here`

### Architecture note: remotes are code bundles

Remotes in `bos.app.ts` are **not hosted APIs** — they are code bundles loaded via Module Federation at runtime. The UI, API, auth, and plugins all run in the same host process. There is no remote server to call; everything is loaded in-process through Module Federation and `every-plugin`.

## Troubleshooting

**Process won't start:**
```bash
bos kill        # Kill all tracked processes
pnpm install    # Ensure dependencies
pnpm run dev    # Restart
```

**Docker commands hang instead of failing:** the daemon is down (it hangs, not fails — a slow API call masks it). Start Docker Desktop and retry; probe with a short timeout, don't extend the timeout hoping it completes.

**Module Federation errors:**
- Check `bos.app.ts` URLs are accessible
- Verify shared dependency versions match in package.json
- Clear browser cache

**Database issues:**
```bash
pnpm run db:push   # Push schema changes
pnpm run db:studio # Open Drizzle Studio
```

## Environment

**Required files:**
- `.env` — Secrets (see `.env.example`)
- `bos.app.ts` — Runtime configuration (committed)
