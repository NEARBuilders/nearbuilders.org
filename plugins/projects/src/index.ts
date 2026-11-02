import { ORPCError } from "@orpc/server";
import { Cause, Effect, Layer } from "effect";
import { createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import type { AuthContext } from "./lib/auth";
import { ProjectService, ProjectServiceLive } from "./services/projects";

type ProjectsContext = AuthContext & {
  allowPublicVisibility?: boolean;
  internalOrganizationCleanup?: boolean;
};

const ProjectsContextSchema = z.custom<ProjectsContext>();

const toRouteError = (label?: string) => (cause: Cause.Cause<unknown>) => {
  const squashed = Cause.squash(cause);
  if (label) console.error(`[Projects] ${label} failed:`, squashed);
  if (squashed instanceof ORPCError) return Effect.fail(squashed);
  return Effect.fail(
    new ORPCError("INTERNAL_SERVER_ERROR", {
      message: squashed instanceof Error ? squashed.message : String(squashed),
    }),
  );
};

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    PROJECTS_DATABASE_URL: z.string().default("pglite:.bos/projects/:memory:"),
  }),

  context: ProjectsContextSchema,

  contract,

  initialize: (config) =>
    Effect.sync(() => {
      const ProjectServices = ProjectServiceLive.pipe(
        Layer.provide(DatabaseLive(config.secrets.PROJECTS_DATABASE_URL)),
      );

      const Lifecycle = Layer.effectDiscard(
        Effect.gen(function* () {
          yield* ProjectService;
          console.log("[Projects] Services Initialized");
          yield* Effect.addFinalizer(() => Effect.log("[Projects] Shutdown"));
        }),
      );

      return Lifecycle.pipe(Layer.provideMerge(ProjectServices));
    }),

  createRouter: (builder) => {
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

    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    const requireInternalOrganizationCleanup = builder.middleware(async ({ context, next }) => {
      if (context.internalOrganizationCleanup !== true) {
        throw new ORPCError("FORBIDDEN", { message: "Internal organization cleanup required" });
      }
      return next({ context });
    });

    /**
     * Every id besides the canonical owner id that the caller's rows may be owned by: their
     * other linked NEAR accounts and their user id (#362). A primary switch or a later NEAR
     * link must not cost the caller their own records.
     */
    const getAlternateOwnerIds = (context: {
      userId?: string | null;
      near?: {
        primaryAccountId?: string | null;
        linkedAccounts?: Array<{ accountId?: string | null }> | null;
      };
    }): string[] => {
      const ownerId = context.near?.primaryAccountId ?? context.userId;
      const ids = [
        ...(context.near?.linkedAccounts ?? []).map((account) => account.accountId),
        context.userId,
      ].filter((id): id is string => Boolean(id) && id !== ownerId);
      return [...new Set(ids)];
    };

    const getOrganizationMemberships = (context: {
      organizations?: Array<{ id: string; role: string }>;
    }) => context.organizations ?? undefined;

    return {
      listProjects: builder.listProjects.effect(function* ({ input, context }) {
        const project = yield* ProjectService;
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        return yield* project
          .listProjects(
            input,
            ownerId,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
          )
          .pipe(Effect.catchCause(toRouteError("listProjects")));
      }),

      getProject: builder.getProject.effect(function* ({ input, errors, context }) {
        const project = yield* ProjectService;
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        const result = yield* project
          .getProject(
            input.id,
            ownerId,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
            getOrganizationMemberships(context),
          )
          .pipe(Effect.catchCause(toRouteError("getProject")));

        if (!result) {
          return yield* Effect.fail(
            errors.NOT_FOUND({
              message: "Project not found",
              data: { resource: "project", resourceId: input.id },
            }),
          );
        }

        return { data: result };
      }),

      getProjectBySlug: builder.getProjectBySlug.effect(function* ({ input, errors, context }) {
        const project = yield* ProjectService;
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        const result = yield* project
          .getProjectBySlug(
            input.slug,
            ownerId,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
            getOrganizationMemberships(context),
          )
          .pipe(Effect.catchCause(toRouteError("getProjectBySlug")));

        if (!result) {
          return yield* Effect.fail(
            errors.NOT_FOUND({
              message: "Project not found",
              data: { resource: "project", resourceId: input.slug },
            }),
          );
        }

        return { data: result };
      }),

      createProject: builder.createProject.use(requireAuth).effect(function* ({ input, context }) {
        const project = yield* ProjectService;
        const ownerId = context.near?.primaryAccountId ?? context.userId ?? undefined;
        const isAdmin = context.user.role === "admin";
        if (!isAdmin && !context.near?.primaryAccountId) {
          return yield* Effect.fail(
            new ORPCError("FORBIDDEN", { message: "Link a NEAR account to create content" }),
          );
        }
        const visibility =
          isAdmin || context.allowPublicVisibility === true
            ? input.visibility
            : input.visibility === "unlisted"
              ? "unlisted"
              : "private";
        return yield* project
          .createProject(
            { ...input, visibility },
            ownerId,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
            getOrganizationMemberships(context),
          )
          .pipe(Effect.catchCause(toRouteError("createProject")));
      }),

      updateProject: builder.updateProject.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const project = yield* ProjectService;
        return yield* project
          .updateProject(
            input.id,
            input,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
            context.allowPublicVisibility === true,
            getOrganizationMemberships(context),
          )
          .pipe(
            Effect.catchCause(toRouteError("updateProject")),
            Effect.mapError((error) =>
              error.code === "NOT_FOUND"
                ? errors.NOT_FOUND({
                    message: "Project not found",
                    data: { resource: "project", resourceId: input.id },
                  })
                : error,
            ),
          );
      }),

      applyReviewedProject: builder.applyReviewedProject.use(requireAdmin).effect(function* ({
        input,
      }) {
        const project = yield* ProjectService;
        const existing = yield* project.getProject(input.id, input.ownerId);
        if (!existing) {
          return yield* Effect.fail(new ORPCError("NOT_FOUND", { message: "Project not found" }));
        }
        return yield* project
          .updateProject(input.id, input, input.ownerId, "admin")
          .pipe(Effect.catchCause(toRouteError()));
      }),

      deleteProject: builder.deleteProject.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const project = yield* ProjectService;
        return yield* project
          .deleteProject(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
          )
          .pipe(
            Effect.catchCause(toRouteError("deleteProject")),
            Effect.mapError((error) =>
              error.code === "NOT_FOUND"
                ? errors.NOT_FOUND({
                    message: "Project not found",
                    data: { resource: "project", resourceId: input.id },
                  })
                : error,
            ),
          );
      }),

      clearOrganizationAttribution: builder.clearOrganizationAttribution
        .use(requireInternalOrganizationCleanup)
        .effect(function* ({ input }) {
          const project = yield* ProjectService;
          return yield* project
            .clearOrganizationAttribution(input.organizationId)
            .pipe(Effect.catchCause(toRouteError("clearOrganizationAttribution")));
        }),

      listProjectApps: builder.listProjectApps.effect(function* ({ input }) {
        const project = yield* ProjectService;
        const data = yield* project
          .listProjectApps(input.projectId)
          .pipe(Effect.catchCause(toRouteError("listProjectApps")));
        return { data };
      }),

      linkAppToProject: builder.linkAppToProject.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const project = yield* ProjectService;
        return yield* project
          .linkAppToProject(
            input.projectId,
            input.accountId,
            input.domain,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
            getOrganizationMemberships(context),
          )
          .pipe(
            Effect.catchCause(toRouteError("linkAppToProject")),
            Effect.mapError((error) =>
              error.code === "NOT_FOUND"
                ? errors.NOT_FOUND({
                    message: "Project not found",
                    data: { resource: "project", resourceId: input.projectId },
                  })
                : error,
            ),
          );
      }),

      unlinkAppFromProject: builder.unlinkAppFromProject.use(requireAuth).effect(function* ({
        input,
        context,
        errors,
      }) {
        const project = yield* ProjectService;
        return yield* project
          .unlinkAppFromProject(
            input.projectId,
            input.accountId,
            input.domain,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
            getOrganizationMemberships(context),
          )
          .pipe(
            Effect.catchCause(toRouteError("unlinkAppFromProject")),
            Effect.mapError((error) =>
              error.code === "NOT_FOUND"
                ? errors.NOT_FOUND({
                    message: "Project or app not found",
                    data: { resource: "project-app" },
                  })
                : error,
            ),
          );
      }),

      listProjectsForApp: builder.listProjectsForApp.effect(function* ({ input, context }) {
        const project = yield* ProjectService;
        const data = yield* project
          .listProjectsForApp(
            input.accountId,
            input.domain,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
          )
          .pipe(Effect.catchCause(toRouteError("listProjectsForApp")));
        return { data };
      }),

      listMentions: builder.listMentions.effect(function* ({ input, context }) {
        const project = yield* ProjectService;
        const data = yield* project
          .listMentions(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
          )
          .pipe(Effect.catchCause(toRouteError("listMentions")));
        return { data };
      }),

      listMentionedBy: builder.listMentionedBy.effect(function* ({ input, context }) {
        const project = yield* ProjectService;
        const data = yield* project
          .listMentionedBy(
            input.id,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
          )
          .pipe(Effect.catchCause(toRouteError("listMentionedBy")));
        return { data };
      }),

      listCollaborators: builder.listCollaborators.effect(function* ({ input, context }) {
        const project = yield* ProjectService;
        const data = yield* project
          .listCollaborators(
            input.projectId,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
            context.user?.role ?? undefined,
            getOrganizationMemberships(context),
          )
          .pipe(Effect.catchCause(toRouteError()));
        return { data };
      }),

      inviteCollaborator: builder.inviteCollaborator.use(requireAuth).effect(function* ({
        input,
        context,
      }) {
        const project = yield* ProjectService;
        return yield* project
          .inviteCollaborator(
            input.projectId,
            input.collaboratorOwnerId,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
          )
          .pipe(Effect.catchCause(toRouteError()));
      }),

      respondCollaborator: builder.respondCollaborator.use(requireAuth).effect(function* ({
        input,
        context,
      }) {
        const project = yield* ProjectService;
        return yield* project
          .respondCollaborator(
            input.projectId,
            input.action,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
          )
          .pipe(Effect.catchCause(toRouteError()));
      }),

      removeCollaborator: builder.removeCollaborator.use(requireAuth).effect(function* ({
        input,
        context,
      }) {
        const project = yield* ProjectService;
        return yield* project
          .removeCollaborator(
            input.projectId,
            input.collaboratorOwnerId,
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            context.user.role ?? undefined,
            getAlternateOwnerIds(context),
          )
          .pipe(Effect.catchCause(toRouteError()));
      }),

      listMyCollaborations: builder.listMyCollaborations.use(requireAuth).effect(function* ({
        input,
        context,
      }) {
        const project = yield* ProjectService;
        const data = yield* project
          .listMyCollaborations(
            context.near?.primaryAccountId ?? context.userId ?? undefined,
            getAlternateOwnerIds(context),
            input.status ?? undefined,
            input.limit ?? undefined,
          )
          .pipe(Effect.catchCause(toRouteError()));
        return { data };
      }),
    };
  },
});
