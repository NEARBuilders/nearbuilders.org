/**
 * Client router — the app's authored router factory, the single customization
 * seam for router policy (notFound/pending/error components, scroll behavior,
 * query timings via the `createQueryClient` export). Minted through the
 * framework's client factory; the composed manifest tree arrives at call
 * time and wins over the bundled core-only tree.
 *
 * This file is yours — scaffolded once, never overwritten by `bos sync`
 * (ADR 0023). Edit the policy defaults after the `...opts` spread freely.
 */

import { createRouter as createCoreRouter } from "everything-dev/ui/router-client";
import type { ApiClient, CreateRouterOptions, SessionData } from "./app";
import { routeTree } from "./routeTree.gen";

export type {
  ClientRuntimeConfig,
  CreateRouterOptions,
  RouterContext,
  RouterModule,
} from "./app";

export function createRouter(opts: CreateRouterOptions) {
  return createCoreRouter<ApiClient, SessionData, typeof routeTree>({
    ...opts,
    defaultRouteTree: routeTree,
  });
}

export { routeTree };

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>["router"];
  }
}
