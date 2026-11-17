# Effect Patterns

Effect v4 pattern reference for this repo. Vendored source of truth: `repos/effect/`
(tag `effect@4.0.0-rc.112`, read-only — never edit or import from it). Consult this
file first for the repo's conventions; when a signature is unclear, read the vendored
source listed under [Pointers](#pointers) instead of guessing from Effect v3 docs.

## Service definitions

Effect 4 uses `Context.Service<Self, Shape>()("id")` class tags. `Context.Tag` and
`Effect.Service` are removed. Methods returning effects have `R = never`; a service
interface must never leak requirements.

This repo's plugins (auth, proposals) use two shapes for the Live layer — both fine,
pick per service and stay consistent within a plugin:

- **Static layer** (docs exemplar below): `static readonly layer = Layer.effect(Tag, ...)` on the class.
- **Module-level Live + plain factory** (auth plugin): `export const XServiceLive = Layer.effect(X, Effect.gen(...))`
  with a `buildXService({ dep })` plain function returning `X.of({...})` — the factory is the
  test-harness seam (tests assemble the service directly over test doubles); `X.of` makes the
  class shape the single type-enforcement point. Structured methods use
  `Effect.fn("XService.method")` for spans.

```ts
import { Context, Effect, Layer } from "effect";

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  message: Schema.String,
}) {}

export class Database extends Context.Service<Database, {
  query(sql: string): Effect.Effect<Array<unknown>, DatabaseError>;
}>()("myapp/db/Database") {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* () {
      const query = Effect.fn("Database.query")(function* (sql: string) {
        yield* Effect.log("Executing SQL query:", sql);
        return [{ id: 1, name: "Alice" }];
      });
      return Database.of({ query });
    }),
  );
}

export type DatabaseService = Database["Service"];
```

Use the tag like any service: `const db = yield* Database;` inside `Effect.gen`, or
`Database.use((db) => db.query("SELECT 1"))`. The id string should be unique
(`<package>/<path>` is the upstream convention; this repo uses short ids like
`"registry/RegistryService"`).

## Layer composition

Verified v4 Layer API: `Layer.effect(tag, effect)`, `Layer.succeed(tag, value)`,
`Layer.sync(tag, fn)`, `Layer.effectDiscard(effect)` (background tasks, no service in
the output), `Layer.unwrap`, `Layer.succeedContext(context)`, `Layer.merge`,
`Layer.mergeAll`, `Layer.provide`, `Layer.provideMerge`, `Layer.build`,
`Layer.buildWithScope`, `Layer.launch`. `Layer.provideMerge` exposes the dependency's
services alongside the built one; `Layer.provide` exposes only the built one. Prefer
`Layer.provide` and compose dependencies explicitly.

```ts
import { Context, Effect, Layer } from "effect";

export class HttpClient extends Context.Service<HttpClient, {
  get(url: string): Effect.Effect<string>;
}>()("myapp/HttpClient") {}

export class ApiClient extends Context.Service<ApiClient, {
  fetchUser(id: string): Effect.Effect<string>;
}>()("myapp/ApiClient") {
  static readonly layer = Layer.effect(
    ApiClient,
    Effect.gen(function* () {
      const http = yield* HttpClient;
      return ApiClient.of({
        fetchUser: (id) => http.get(`/users/${id}`),
      });
    }),
  ).pipe(Layer.provide(HttpClient.layer));
}

const live = Layer.mergeAll(ApiClient.layer, HttpClient.layer);
```

Never `Effect.provide(Effect, Tag, Layer.effect(...))` for persistent dependencies:
`Effect.provide` runs the layer in a transient scope, so finalizers release the
resource as soon as the wrapped effect finishes. Inside a plugin `initialize`, build
against the plugin's lifecycle scope instead, using `buildScoped` / `buildScopedContext`
from `"every-plugin"` (packages/every-plugin/src/effect-helpers.ts). The returned
resource lives until plugin shutdown.

```ts
import { buildScoped, buildScopedContext } from "every-plugin";

export const AppRegistry = createPlugin({
  initialize: (config) =>
    Effect.gen(function* () {
      const registry = yield* buildScoped(RegistryService, RegistryService.Live);
      const context = yield* buildScopedContext(SharedLayers);
      const cache = Context.get(context, CacheService);
      return Effect.succeed(router);
    }),
});
```

Compose dependent layers with `Layer.mergeAll(...).pipe(Layer.provide(dep))` and
return the Layer from `initialize`; the runtime builds it against the plugin scope.

## Effect.gen conventions

- Prefer `Effect.gen` + `Effect.fn("name")`. Do not create functions that return
  `Effect.gen`; use `Effect.fn` so stack traces and spans are attached.
- Name the string in `Effect.fn` after the function.
- For a definitive failure exit inside a generator, `return yield* Effect.fail(...)`
  (or `return yield* new SomeError({...})`) so TypeScript knows execution stops.
- Attach combinators via `.pipe` on plain effects. With `Effect.fn`, pass
  combinators as additional arguments — do not `.pipe` an `Effect.fn` result.

```ts
import { Effect } from "effect";

export const processFile = Effect.fn("processFile")(function* (path: string) {
  const content = yield* read(path);
  if (content.length === 0) {
    return yield* Effect.fail(new FileProcessingError({ message: "empty file" }));
  }
  return content.length;
});
```

## Error handling

- Define errors with `Schema.TaggedError`. Keep the error union explicit and verbose
  on the `Effect` type: `Effect.Effect<A, ParseError | ReservedPortError>`.
- Handle with `Effect.catchTag("Tag", handler)`, `Effect.catchTag(["A", "B"], handler)`,
  `Effect.catchTags({...})`, or `Effect.catch` for all errors.
- Do not use `try/catch` around effectful code to handle Effect errors; typed errors
  travel the error channel, not exceptions. `Effect.die` is for defects only.

```ts
export const recovered = loadPort("80").pipe(
  Effect.catchTag(["ParseError", "ReservedPortError"], () => Effect.succeed(3000)),
);
```

## Scoped resources

- One-off acquisition: `Effect.acquireUseRelease(acquire, use, release)` or
  `Effect.acquireRelease` (plus `Scope` in `R`).
- Services: acquire inside `Layer.effect`'s generator with `Effect.acquireRelease`;
  finalizers run when the layer's scope closes. Background work without a service:
  `Layer.effectDiscard`.
- Plugin lifecycle: the every-plugin runtime builds the `initialize` Layer result
  against the plugin's lifecycle scope, so pools, clients, and caches built via
  `buildScoped` are finalized on plugin shutdown. There is no `shutdown` callback —
  teardown lives in Layer finalizers (`Effect.addFinalizer` inside the builder).

```ts
export class Pool extends Context.Service<Pool, {
  run<A>(f: (conn: Conn) => Effect.Effect<A>): Effect.Effect<A>;
}>()("myapp/Pool") {
  static readonly layer = Layer.effect(
    Pool,
    Effect.gen(function* () {
      const acquire = Effect.promise(() => connect());
      const conn = yield* Effect.acquireRelease(acquire, (c) =>
        Effect.promise(() => c.close()));
      return Pool.of({
        run: (f) => f(conn),
      });
    }),
  );
}
```

## What to avoid (v3 patterns that fail in v4)

- `class Foo extends Context.Tag("Foo")<Foo, Shape>()` — removed. Use
  `Context.Service<Self, Shape>()("id")`.
- `Effect.Service` / `Effect.Service()` class syntax — removed.
- `shutdown` option on plugin `initialize` — gone; use Layer finalizers and
  `buildScoped` (plugin scope).
- `try/catch` to swallow typed errors — breaks the error channel; use `Effect.catch*`.
- Requirement leakage — service interfaces must keep `R = never`; hide dependencies
  behind the service methods, not in the interface.
- `Layer.launch`/`Layer.build` inside `initialize` for long-lived resources — use
  `buildScoped`/`buildScopedContext` so the plugin scope owns finalization.
- Predicates like `isRecord`/`isString` hand-rolled — use the `Predicate` module.

## Pointers

Vendored source (read-only) under `repos/effect/packages/effect/src/`:

| Pattern | File |
|---|---|
| Service tags, `Context.Service`, `Context.make/add/get` | `Context.ts` |
| `Layer.effect/succeed/merge/provide/provideMerge`, finalization | `Layer.ts` |
| `Effect.gen`, `Effect.fn`, `fail`, `catchTag(s)`, `acquireUseRelease`, `addFinalizer` | `Effect.ts` |
| `Schema.TaggedError`, domain models | `Schema.ts` |
| Tagged reasons, `Effect.catchReason(s)` | `Cause.ts`, `Effect.ts` |
| `Scope` type, `Effect.scope` | `Scope.ts` |
| Dynamic keyed resources | `LayerMap.ts`, `RcMap.ts`, `RcRef.ts` |
| Bridge to non-Effect code | `ManagedRuntime.ts`, `Runtime.ts` |

Upstream examples: `repos/effect/packages/effect/test/` and
`repos/effect/packages/platform/src/` (service definition + layer composition
idioms). Repo helpers: `packages/every-plugin/src/effect-helpers.ts`. Read
`repos/effect/LLMS.md` for the upstream overview before writing new Effect code.
