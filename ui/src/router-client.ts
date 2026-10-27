/**
 * LOCAL SHIM — stand-in for `everything-dev/ui/router-client`.
 *
 * Why this exists: the pinned framework release predates the v2 train and
 * does not publish `ui/router-client`. This shim lets the authored router
 * seam (router.tsx importing createCoreRouter from
 * `everything-dev/ui/router-client`) resolve and typecheck regardless.
 *
 * Upstream canonical shape to conform to:
 *   createCoreRouter<ApiClient, SessionData, typeof routeTree>({
     ...opts,
     defaultRouteTree: routeTree,
   })
 * Conformance rules this shim must keep:
 *   1. Accept `defaultRouteTree` and forward it as `routeTree`.
 *   2. Spread caller opts LAST so overrides win over shim defaults.
 *   3. Preserve the <TApiClient, TSession, TRouteTree> generic signature.
 *
 * Detecting native availability (upgrade off this shim):
 *   ls node_modules/everything-dev/dist/ui/router-client.d.mts
 * v2 releases of everything-dev publish that module.
 *
 * Exit path (once on a framework version that publishes ui/router-client):
 *   1. Delete this file.
 *   2. Remove the "everything-dev/ui/router-client" entry from
 *      ui/tsconfig.json compilerOptions.paths.
 *   3. Run `pnpm run typecheck` — resolution must fall through to the
 *      framework module with no type errors.
 *
 * NOTE: the upgrade audit classifies router.tsx as authored-seam by its
 * import string, so re-running `bos upgrade` will never revisit this
 * shim — migration off it is manual by design.
 */

import type { CreateRouterOptions } from "@tanstack/react-router";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";

export function createCoreRouter<TApiClient, TSession, TRouteTree extends object>(
  opts: Omit<CreateRouterOptions<TApiClient, TSession>, "routeTree"> & {
    defaultRouteTree?: TRouteTree;
  },
) {
  return createTanStackRouter({
    ...opts,
    ...(opts.defaultRouteTree ? { routeTree: opts.defaultRouteTree } : {}),
  });
}
