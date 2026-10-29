import { ORPCError } from "@orpc/server";
import { Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { CatalogService, CatalogServiceLive } from "./services/catalog";
import { ClaimService, ClaimServiceLive } from "./services/claims";

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
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.sync(() =>
      Layer.mergeAll(
        CatalogServiceLive(config.variables.baseUrl),
        ClaimServiceLive.pipe(Layer.provide(DatabaseLive(config.secrets.NEARCATALOG_DATABASE_URL))),
      ),
    ),

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
    };
  },
});
