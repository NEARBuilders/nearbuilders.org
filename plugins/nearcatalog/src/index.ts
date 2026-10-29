import { ORPCError } from "@orpc/server";
import { Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { CATALOG_LISTING_SYNC, contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { CatalogService, CatalogServiceLive } from "./services/catalog";
import { createCatalogSubmitClientFromConfig } from "./services/catalog-submit";
import { ClaimService, ClaimServiceLive } from "./services/claims";
import { ListingService, ListingServiceLive } from "./services/listings";

function matchesProjectQuery(
  project: {
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    repositoryUrl: string | null;
    tags: string[];
    phase: string | null;
    status: string | null;
  },
  contributors: Array<{ nearAccount: string }>,
  query?: string,
) {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return [
    project.slug,
    project.name,
    project.tagline,
    project.description,
    project.repositoryUrl,
    project.phase,
    project.status,
    ...project.tags,
    ...contributors.map((contributor) => contributor.nearAccount),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export default createPlugin({
  variables: z.object({
    baseUrl: z.url().default("https://api.nearcatalog.xyz"),
  }),

  secrets: z.object({
    NEARCATALOG_DATABASE_URL: z.string().default("pglite:.bos/nearcatalog/:memory:"),
    NEARCATALOG_SUBMIT_URL: z.string().optional(),
    NEARCATALOG_SUBMIT_TOKEN: z.string().optional(),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.sync(() => {
      const submitter = createCatalogSubmitClientFromConfig({
        url: config.secrets.NEARCATALOG_SUBMIT_URL,
        token: config.secrets.NEARCATALOG_SUBMIT_TOKEN,
      });
      return Layer.mergeAll(
        CatalogServiceLive(config.variables.baseUrl),
        Layer.mergeAll(ClaimServiceLive, ListingServiceLive(submitter)).pipe(
          Layer.provide(DatabaseLive(config.secrets.NEARCATALOG_DATABASE_URL)),
        ),
      );
    }),

  createRouter: (builder) => {
    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context });
    });

    const requireListingSync = builder.middleware(async ({ context, next }) => {
      if ((context as unknown as Record<symbol, unknown>)[CATALOG_LISTING_SYNC] === true) {
        return next({ context });
      }
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context });
    });

    return {
      searchCatalogProjects: builder.searchCatalogProjects.effect(function* ({ input }) {
        const catalog = yield* CatalogService;
        return { data: yield* catalog.searchProjects(input.query) };
      }),

      listCatalogCategories: builder.listCatalogCategories.effect(function* () {
        const catalog = yield* CatalogService;
        return { data: yield* catalog.listCategories() };
      }),

      getCatalogProject: builder.getCatalogProject.effect(function* ({ input }) {
        const catalog = yield* CatalogService;
        return { data: yield* catalog.getProject(input.slug) };
      }),

      listCatalogClaims: builder.listCatalogClaims.effect(function* ({ input }) {
        const claims = yield* ClaimService;
        return yield* claims.listClaims(input);
      }),

      listClaimedCatalogProjects: builder.listClaimedCatalogProjects.effect(function* ({ input }) {
        const catalog = yield* CatalogService;
        const claimService = yield* ClaimService;
        const claimsByProject = yield* claimService.listClaimsByProject(input.nearAccount);
        const projects = yield* Effect.forEach(
          Array.from(claimsByProject),
          ([slug, claims]) =>
            catalog.getProject(slug).pipe(
              Effect.map((project) => ({
                project,
                contributors: claims.map(({ id, nearAccount, roles, createdAt, updatedAt }) => ({
                  id,
                  nearAccount,
                  roles,
                  createdAt,
                  updatedAt,
                })),
              })),
              Effect.catchCause(() => Effect.succeed(null)),
            ),
          { concurrency: 5 },
        );
        const available = projects
          .filter((project) => project !== null)
          .filter(({ project, contributors }) =>
            matchesProjectQuery(project, contributors, input.query),
          );
        const limit = Math.min(input.limit ?? 50, 100);
        const offset = input.cursor ? Math.max(Number.parseInt(input.cursor, 10) || 0, 0) : 0;
        const data = available.slice(offset, offset + limit);
        const nextOffset = offset + limit;
        const hasMore = nextOffset < available.length;

        return {
          data,
          meta: {
            total: available.length,
            hasMore,
            nextCursor: hasMore ? String(nextOffset) : null,
          },
        };
      }),

      getCatalogClaimHistory: builder.getCatalogClaimHistory.use(requireAdmin).effect(function* ({
        input,
      }) {
        const claims = yield* ClaimService;
        return { data: yield* claims.getClaimHistory(input.id) };
      }),

      applyCatalogClaim: builder.applyCatalogClaim.use(requireAdmin).effect(function* ({ input }) {
        const catalog = yield* CatalogService;
        const claims = yield* ClaimService;
        yield* catalog.getProject(input.projectSlug);
        return { data: yield* claims.applyClaim(input) };
      }),

      setCatalogClaimActivity: builder.setCatalogClaimActivity.use(requireAdmin).effect(function* ({
        input,
      }) {
        const claims = yield* ClaimService;
        return { data: yield* claims.setClaimActivity(input.id, input.activityEventId) };
      }),

      revokeCatalogClaim: builder.revokeCatalogClaim.use(requireAdmin).effect(function* ({
        input,
      }) {
        const claims = yield* ClaimService;
        return { data: yield* claims.revokeClaim(input.id) };
      }),

      exportCatalogProjects: builder.exportCatalogProjects.effect(function* ({ input }) {
        const listings = yield* ListingService;
        return yield* listings.exportProjects(input.since);
      }),

      exportCatalogPeople: builder.exportCatalogPeople.effect(function* ({ input }) {
        const listings = yield* ListingService;
        return yield* listings.exportPeople(input.since);
      }),

      listCatalogListings: builder.listCatalogListings.effect(function* ({ input }) {
        const listings = yield* ListingService;
        return { data: yield* listings.listListed(input.kind) };
      }),

      markCatalogListingPublished: builder.markCatalogListingPublished
        .use(requireAdmin)
        .effect(function* ({ input }) {
          const listings = yield* ListingService;
          return { data: yield* listings.markPublished(input) };
        }),

      getCatalogListing: builder.getCatalogListing.use(requireListingSync).effect(function* ({
        input,
      }) {
        const listings = yield* ListingService;
        return { data: yield* listings.getListing(input) };
      }),

      markCatalogListingPending: builder.markCatalogListingPending
        .use(requireListingSync)
        .effect(function* ({ input }) {
          const listings = yield* ListingService;
          return { data: yield* listings.markPending(input) };
        }),

      approveCatalogListing: builder.approveCatalogListing
        .use(requireListingSync)
        .effect(function* ({ input }) {
          const listings = yield* ListingService;
          return { data: yield* listings.approve(input) };
        }),

      rejectCatalogListing: builder.rejectCatalogListing.use(requireListingSync).effect(function* ({
        input,
      }) {
        const listings = yield* ListingService;
        return { data: yield* listings.reject(input) };
      }),

      withdrawCatalogListing: builder.withdrawCatalogListing
        .use(requireListingSync)
        .effect(function* ({ input }) {
          const listings = yield* ListingService;
          return { data: yield* listings.withdraw(input) };
        }),

      listCatalogListingSends: builder.listCatalogListingSends
        .use(requireAdmin)
        .effect(function* () {
          const listings = yield* ListingService;
          return yield* listings.listSends();
        }),

      retryCatalogListingSend: builder.retryCatalogListingSend.use(requireAdmin).effect(function* ({
        input,
      }) {
        const listings = yield* ListingService;
        return { data: yield* listings.retrySend(input) };
      }),

      refreshCatalogListingRecord: builder.refreshCatalogListingRecord
        .use(requireListingSync)
        .effect(function* ({ input }) {
          const listings = yield* ListingService;
          return { data: yield* listings.refreshRecord(input) };
        }),
    };
  },
});
