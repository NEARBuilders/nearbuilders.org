import migrations from "virtual:drizzle-migrations.sql";
import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { createDatabaseDriver } from "./db";
import { migrate } from "./db/migrator";
import { ContextSchema } from "./lib/context";
import { createCatalogMethods } from "./services/catalog";
import { createClaimMethods } from "./services/claims";

async function runEffect<A>(effect: Effect.Effect<A, ORPCError<string, unknown>>) {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    const squashed = Cause.squash(exit.cause);
    if (squashed instanceof ORPCError) throw squashed;
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: squashed instanceof Error ? squashed.message : String(squashed),
    });
  }
  return exit.value;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
    Effect.promise(async () => {
      const driver = await createDatabaseDriver(config.secrets.NEARCATALOG_DATABASE_URL);
      try {
        await migrate(driver.db, migrations);
      } catch (error) {
        await driver.close();
        throw error;
      }
      const claims = createClaimMethods(driver.db);
      const catalog = createCatalogMethods(config.variables.baseUrl);

      console.log("[NearCatalog] Migrations applied");
      console.log("[NearCatalog] Services Initialized");
      return { catalog, claims, driver };
    }),

  shutdown: (services) =>
    Effect.promise(async () => {
      await services.driver.close();
      console.log("[NearCatalog] Shutdown");
    }),

  createRouter: (services, builder) => {
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
      searchCatalogProjects: builder.searchCatalogProjects.handler(async ({ input }) => ({
        data: await runEffect(services.catalog.searchProjects(input.query, input.limit)),
      })),

      getCatalogProject: builder.getCatalogProject.handler(async ({ input }) => ({
        data: await runEffect(services.catalog.getProject(input.slug)),
      })),

      listCatalogClaims: builder.listCatalogClaims.handler(async ({ input }) => {
        return await runEffect(services.claims.listClaims(input));
      }),

      listClaimedCatalogProjects: builder.listClaimedCatalogProjects.handler(async ({ input }) => {
        const claimsByProject = await runEffect(
          services.claims.listClaimsByProject(input.nearAccount),
        );
        const projects = await mapWithConcurrency(
          Array.from(claimsByProject),
          5,
          async ([slug, claims]) => {
            try {
              const project = await runEffect(services.catalog.getProject(slug));
              if (project.status !== "active") return null;
              return {
                project,
                contributors: claims.map(({ id, nearAccount, roles, createdAt, updatedAt }) => ({
                  id,
                  nearAccount,
                  roles,
                  createdAt,
                  updatedAt,
                })),
              };
            } catch (error) {
              if (error instanceof ORPCError) return null;
              throw error;
            }
          },
        );
        const available = projects.filter((project) => project !== null);
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

      getCatalogClaimHistory: builder.getCatalogClaimHistory
        .use(requireAdmin)
        .handler(async ({ input }) => ({
          data: await runEffect(services.claims.getClaimHistory(input.id)),
        })),

      applyCatalogClaim: builder.applyCatalogClaim
        .use(requireAdmin)
        .handler(async ({ input, errors }) => {
          const project = await runEffect(services.catalog.getProject(input.projectSlug));
          if (project.status !== "active") {
            throw errors.BAD_REQUEST({
              message: "Only active Catalog projects can be claimed",
              data: {},
            });
          }
          return { data: await runEffect(services.claims.applyClaim(input)) };
        }),

      setCatalogClaimActivity: builder.setCatalogClaimActivity
        .use(requireAdmin)
        .handler(async ({ input }) => ({
          data: await runEffect(services.claims.setClaimActivity(input.id, input.activityEventId)),
        })),

      revokeCatalogClaim: builder.revokeCatalogClaim
        .use(requireAdmin)
        .handler(async ({ input }) => ({
          data: await runEffect(services.claims.revokeClaim(input.id)),
        })),
    };
  },
});
