import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { ProjectService, ProjectServiceLive } from "./services/projects";

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    PROJECTS_DATABASE_URL: z.string().default("pglite:.bos/projects/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.PROJECTS_DATABASE_URL);

      const ProjectServices = ProjectServiceLive.pipe(Layer.provide(Database));
      const project = yield* Effect.provide(ProjectService, ProjectServices);

      console.log("[Projects] Services Initialized");
      return { project };
    }),

  shutdown: () => Effect.log("[Projects] Shutdown"),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: {
            authType: "session",
            hint: "Sign in with NEAR, passkey, email, phone, or anonymous",
          },
        });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    const getAlternateOwnerId = (context: {
      userId?: string | null;
      near?: { primaryAccountId?: string | null };
    }) =>
      context.near?.primaryAccountId && context.near.primaryAccountId !== context.userId
        ? (context.userId ?? undefined)
        : undefined;

    return {
      listProjects: builder.listProjects.handler(async ({ input, context }) => {
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        const exit = await Effect.runPromiseExit(
          services.project.listProjects(input, ownerId, getAlternateOwnerId(context)),
        );

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] listProjects failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        return exit.value;
      }),

      getProject: builder.getProject.handler(async ({ input, errors, context }) => {
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        const exit = await Effect.runPromiseExit(
          services.project.getProject(input.id, ownerId, getAlternateOwnerId(context)),
        );

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] getProject failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        if (!exit.value) {
          throw errors.NOT_FOUND({
            message: "Project not found",
            data: { resource: "project", resourceId: input.id },
          });
        }

        return { data: exit.value };
      }),

      getProjectBySlug: builder.getProjectBySlug.handler(async ({ input, errors, context }) => {
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        const exit = await Effect.runPromiseExit(
          services.project.getProjectBySlug(input.slug, ownerId, getAlternateOwnerId(context)),
        );

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] getProjectBySlug failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        if (!exit.value) {
          throw errors.NOT_FOUND({
            message: "Project not found",
            data: { resource: "project", resourceId: input.slug },
          });
        }

        return { data: exit.value };
      }),

      createProject: builder.createProject.use(requireAuth).handler(async ({ input, context }) => {
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        const exit = await Effect.runPromiseExit(
          services.project.createProject(input, ownerId, context.user.role ?? undefined),
        );

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] createProject failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        return exit.value;
      }),

      updateProject: builder.updateProject
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const exit = await Effect.runPromiseExit(
            services.project.updateProject(
              input.id,
              input,
              context.near?.primaryAccountId ?? context.userId ?? undefined,
              context.user.role ?? undefined,
              getAlternateOwnerId(context),
            ),
          );

          if (Exit.isFailure(exit)) {
            const squashed = Cause.squash(exit.cause);
            console.error("[Projects] updateProject failed:", squashed);
            if (squashed instanceof ORPCError) {
              if (squashed.code === "NOT_FOUND") {
                throw errors.NOT_FOUND({
                  message: "Project not found",
                  data: { resource: "project", resourceId: input.id },
                });
              }
              throw squashed;
            }
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: squashed instanceof Error ? squashed.message : String(squashed),
            });
          }

          return exit.value;
        }),

      deleteProject: builder.deleteProject
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const exit = await Effect.runPromiseExit(
            services.project.deleteProject(
              input.id,
              context.near?.primaryAccountId ?? context.userId ?? undefined,
              context.user.role ?? undefined,
              getAlternateOwnerId(context),
            ),
          );

          if (Exit.isFailure(exit)) {
            const squashed = Cause.squash(exit.cause);
            console.error("[Projects] deleteProject failed:", squashed);
            if (squashed instanceof ORPCError) {
              if (squashed.code === "NOT_FOUND") {
                throw errors.NOT_FOUND({
                  message: "Project not found",
                  data: { resource: "project", resourceId: input.id },
                });
              }
              throw squashed;
            }
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: squashed instanceof Error ? squashed.message : String(squashed),
            });
          }

          return exit.value;
        }),

      listProjectApps: builder.listProjectApps.handler(async ({ input }) => {
        const exit = await Effect.runPromiseExit(services.project.listProjectApps(input.projectId));

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] listProjectApps failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        return { data: exit.value };
      }),

      linkAppToProject: builder.linkAppToProject
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const exit = await Effect.runPromiseExit(
            services.project.linkAppToProject(
              input.projectId,
              input.accountId,
              input.domain,
              context.near?.primaryAccountId ?? context.userId ?? undefined,
              context.user.role ?? undefined,
              getAlternateOwnerId(context),
            ),
          );

          if (Exit.isFailure(exit)) {
            const squashed = Cause.squash(exit.cause);
            console.error("[Projects] linkAppToProject failed:", squashed);
            if (squashed instanceof ORPCError) {
              if (squashed.code === "NOT_FOUND") {
                throw errors.NOT_FOUND({
                  message: "Project not found",
                  data: { resource: "project", resourceId: input.projectId },
                });
              }
              throw squashed;
            }
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: squashed instanceof Error ? squashed.message : String(squashed),
            });
          }

          return exit.value;
        }),

      unlinkAppFromProject: builder.unlinkAppFromProject
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const exit = await Effect.runPromiseExit(
            services.project.unlinkAppFromProject(
              input.projectId,
              input.accountId,
              input.domain,
              context.near?.primaryAccountId ?? context.userId ?? undefined,
              context.user.role ?? undefined,
              getAlternateOwnerId(context),
            ),
          );

          if (Exit.isFailure(exit)) {
            const squashed = Cause.squash(exit.cause);
            console.error("[Projects] unlinkAppFromProject failed:", squashed);
            if (squashed instanceof ORPCError) {
              if (squashed.code === "NOT_FOUND") {
                throw errors.NOT_FOUND({
                  message: "Project or app not found",
                  data: { resource: "project-app" },
                });
              }
              throw squashed;
            }
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: squashed instanceof Error ? squashed.message : String(squashed),
            });
          }

          return exit.value;
        }),

      listProjectsForApp: builder.listProjectsForApp.handler(async ({ input, context }) => {
        const exit = await Effect.runPromiseExit(
          services.project.listProjectsForApp(
            input.accountId,
            input.domain,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerId(context),
          ),
        );

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] listProjectsForApp failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        return { data: exit.value };
      }),

      listMentions: builder.listMentions.handler(async ({ input, context }) => {
        const exit = await Effect.runPromiseExit(
          services.project.listMentions(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerId(context),
          ),
        );

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] listMentions failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        return { data: exit.value };
      }),

      listMentionedBy: builder.listMentionedBy.handler(async ({ input, context }) => {
        const exit = await Effect.runPromiseExit(
          services.project.listMentionedBy(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerId(context),
          ),
        );

        if (Exit.isFailure(exit)) {
          const squashed = Cause.squash(exit.cause);
          console.error("[Projects] listMentionedBy failed:", squashed);
          if (squashed instanceof ORPCError) throw squashed;
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: squashed instanceof Error ? squashed.message : String(squashed),
          });
        }

        return { data: exit.value };
      }),
    };
  },
});
