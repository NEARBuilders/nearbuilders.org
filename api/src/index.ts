import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { createAuthMiddleware } from "./lib/auth";
import { type Context, ContextSchema, runEffect } from "./lib/context";
import type { PluginsClient } from "./lib/plugins-types.gen";
import { createCatalogClaims } from "./services/catalog-claims";
import { createProposalActivity } from "./services/proposal-activity";
import { createProposalNotifications } from "./services/proposal-notifications";
import {
  assertValidBuilderProposalAccount,
  createProposalOrchestration,
} from "./services/proposal-orchestration";

function notificationContext(context: Context) {
  return {
    ...context,
    userId: context.near?.primaryAccountId ?? context.userId ?? context.user?.id,
  };
}

type VisibilityValue = "private" | "unlisted" | "public";

function enforceContentCreationVisibility(
  user: { role?: string | null } | undefined | null,
  near: { primaryAccountId?: string | null } | undefined | null,
  inputVisibility: VisibilityValue | undefined,
): VisibilityValue {
  const isAdmin = user?.role === "admin";
  if (!isAdmin && !near?.primaryAccountId) {
    throw new ORPCError("FORBIDDEN", {
      message: "Link a NEAR account to create content",
    });
  }
  return !isAdmin && inputVisibility === "public" ? "private" : (inputVisibility ?? "private");
}

export default createPlugin.withPlugins<PluginsClient>()({
  variables: z.object({}),

  secrets: z.object({
    API_DATABASE_URL: z.string().default("pglite:.bos/api/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (_config, plugins) =>
    Effect.sync(() => {
      const { auth, ...restPlugins } = plugins;
      const activity = createProposalActivity(restPlugins);
      const notifications = createProposalNotifications(restPlugins);
      const orchestration = createProposalOrchestration(restPlugins);
      const catalogClaims = createCatalogClaims(restPlugins);
      console.log("[API] Services Initialized");
      console.log("[API] Auth client available:", Boolean(auth));
      console.log("[API] Plugins available:", Object.keys(restPlugins).join(", ") || "none");
      return { auth, plugins: restPlugins, activity, notifications, orchestration, catalogClaims };
    }),

  shutdown: () => Effect.log("[API] Shutdown"),

  createRouter: (services, builder) => {
    const { requireAuth, requireAdmin, requireAuthOrApiKey } = createAuthMiddleware(builder);
    const { notifyApproval, notifyRejection } = services.notifications;
    const activity = services.activity;
    const orchestration = services.orchestration;
    const catalogClaims = services.catalogClaims;

    return {
      ping: builder.ping.handler(async () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
      })),

      authHealth: builder.authHealth.use(requireAuth).handler(async () => ({
        status: "ok",
        emailConfigured: !!process.env.EMAIL_PROVIDER,
        smsConfigured: !!process.env.SMS_PROVIDER,
      })),

      propose: builder.propose.use(requireAuthOrApiKey).handler(async ({ input, context }) => {
        if (input.pluginId === "nearcatalog") {
          throw new ORPCError("BAD_REQUEST", {
            message: "Use the Catalog claim proposal endpoint",
          });
        }
        assertValidBuilderProposalAccount(input);
        return await services.plugins.proposals(context).propose(input);
      }),

      approve: builder.approve.use(requireAdmin).handler(async ({ input, context }) => {
        const proposalsClient = services.plugins.proposals(context);
        const approval = await proposalsClient.approve(input);
        const proposal = {
          id: approval.data.id,
          pluginId: approval.data.pluginId,
          entityId: approval.data.entityId,
          payload: approval.data.payload,
          appliedResourceId: approval.data.appliedResourceId,
          createdBy: approval.data.createdBy,
          submissionCount: approval.data.submissionCount,
        };

        if (approval.data.applyStatus === "applied") {
          return approval;
        }

        let appliedResourceId: string;
        try {
          appliedResourceId = await runEffect(
            Effect.tryPromise({
              try: () => orchestration.applyProposal(proposal, context),
              catch: (error) =>
                new ORPCError("INTERNAL_SERVER_ERROR", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            }),
          );
          await activity.emitApproval(proposal, context);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await proposalsClient.markApplyFailed({
            pluginId: input.pluginId,
            entityId: input.entityId,
            error: message,
          });
          throw error;
        }

        const applied = await proposalsClient.markApplied({
          pluginId: input.pluginId,
          entityId: input.entityId,
          appliedResourceId,
        });
        await notifyApproval(proposal, context);
        return applied;
      }),

      reject: builder.reject.use(requireAdmin).handler(async ({ input, context }) => {
        const proposalsClient = services.plugins.proposals(context);
        const rejected = await proposalsClient.reject(input);
        const proposal = {
          pluginId: rejected.data.pluginId,
          entityId: rejected.data.entityId,
          payload: rejected.data.payload,
          appliedResourceId: rejected.data.appliedResourceId,
          createdBy: rejected.data.createdBy,
          rejectionReason: rejected.data.rejectionReason,
        };
        await notifyRejection(proposal, context);
        return rejected;
      }),

      remove: builder.remove.use(requireAdmin).handler(async ({ input, context }) => {
        const proposalsClient = services.plugins.proposals(context);
        const listed = await proposalsClient.getProposals({
          pluginId: input.pluginId,
          entityId: input.entityId,
          limit: 1,
        });
        const proposalData = listed.data[0];

        if (!proposalData) {
          throw new ORPCError("NOT_FOUND", { message: "Proposal not found" });
        }

        const removal = await proposalsClient.remove(input);

        const proposal = {
          pluginId: proposalData.pluginId,
          entityId: proposalData.entityId,
          payload: proposalData.payload,
          appliedResourceId: proposalData.appliedResourceId,
          createdBy: proposalData.createdBy,
        };

        if (proposalData.applyStatus === "applied") {
          try {
            await runEffect(
              Effect.tryPromise({
                try: () => orchestration.removeProposal(proposal, context),
                catch: (error) =>
                  new ORPCError("INTERNAL_SERVER_ERROR", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              }),
            );
            return await proposalsClient.markRemoved({
              pluginId: input.pluginId,
              entityId: input.entityId,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await proposalsClient.markRemoveFailed({
              pluginId: input.pluginId,
              entityId: input.entityId,
              error: message,
            });
            throw error;
          }
        }

        return removal;
      }),

      getProposals: builder.getProposals.handler(async ({ input, context }) => {
        return await services.plugins.proposals(context).getProposals(input);
      }),

      getProposalCount: builder.getProposalCount.handler(async ({ input, context }) => {
        return await services.plugins.proposals(context).getProposalCount(input);
      }),

      getAuditLog: builder.getAuditLog.handler(async ({ input, context }) => {
        return await services.plugins.proposals(context).getAuditLog(input);
      }),

      subscribeProposals: builder.subscribeProposals.handler(async function* ({ input, context }) {
        const iterator = await services.plugins.proposals(context).subscribe(input);
        for await (const event of iterator) {
          yield event;
        }
      }),

      upvote: builder.upvote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(context).upvote(input);
      }),

      downvote: builder.downvote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(context).downvote(input);
      }),

      getUpvoteCount: builder.getUpvoteCount.handler(async ({ input }) => {
        return await services.plugins.votes().getUpvoteCount(input);
      }),

      getUserVote: builder.getUserVote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(context).getUserVote(input);
      }),

      getUserVotes: builder.getUserVotes.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(context).getUserVotes(input);
      }),

      getUpvoteCounts: builder.getUpvoteCounts.handler(async ({ input }) => {
        return await services.plugins.votes().getUpvoteCounts(input);
      }),

      getUpvoteFeed: builder.getUpvoteFeed.handler(async ({ input }) => {
        return await services.plugins.votes().getUpvoteFeed(input);
      }),

      subscribeUpvotes: builder.subscribeUpvotes.handler(async function* () {
        const iterator = await services.plugins.votes().subscribe();
        for await (const event of iterator) {
          yield event;
        }
      }),

      searchCatalogProjects: builder.searchCatalogProjects.handler(async ({ input }) => {
        return await services.plugins.nearcatalog().searchCatalogProjects(input);
      }),

      getCatalogProject: builder.getCatalogProject.handler(async ({ input }) => {
        return await services.plugins.nearcatalog().getCatalogProject(input);
      }),

      submitCatalogClaimProposal: builder.submitCatalogClaimProposal
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await catalogClaims.submit(input, context);
        }),

      getMyCatalogClaimProposals: builder.getMyCatalogClaimProposals
        .use(requireAuth)
        .handler(async ({ context }) => {
          return await catalogClaims.getMine(context);
        }),

      listCatalogClaims: builder.listCatalogClaims.handler(async ({ input }) => {
        return await services.plugins.nearcatalog().listCatalogClaims(input);
      }),

      listClaimedCatalogProjects: builder.listClaimedCatalogProjects.handler(async ({ input }) => {
        return await services.plugins.nearcatalog().listClaimedCatalogProjects(input);
      }),

      emitActivity: builder.emitActivity.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.activity(context).emitActivity(input);
      }),

      getActivityFeed: builder.getActivityFeed.handler(async ({ input }) => {
        return await services.plugins.activity().getActivityFeed(input);
      }),

      subscribeActivity: builder.subscribeActivity.handler(async function* ({
        input,
        signal,
        lastEventId,
      }) {
        const iterator = await services.plugins
          .activity()
          .subscribeActivity(input, { signal, lastEventId });
        for await (const event of iterator) {
          yield event;
        }
      }),

      getLeaderboard: builder.getLeaderboard.handler(async ({ input }) => {
        return await services.plugins.activity().getLeaderboard(input);
      }),

      getMyNotifications: builder.getMyNotifications
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await services.plugins
            .notifications(notificationContext(context))
            .getMyNotifications(input);
        }),

      markNotificationAsRead: builder.markNotificationAsRead
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await services.plugins
            .notifications(notificationContext(context))
            .markAsRead(input);
        }),

      markAllNotificationsAsRead: builder.markAllNotificationsAsRead
        .use(requireAuth)
        .handler(async ({ context }) => {
          return await services.plugins.notifications(notificationContext(context)).markAllAsRead();
        }),

      subscribeNotifications: builder.subscribeNotifications
        .use(requireAuth)
        .handler(async function* ({ context, signal, lastEventId }) {
          const iterator = await services.plugins
            .notifications(notificationContext(context))
            .subscribeNotifications(undefined, { signal, lastEventId });
          for await (const event of iterator) {
            yield event;
          }
        }),

      listProjects: builder.listProjects.handler(async ({ input, context }) => {
        return await services.plugins.projects(context).listProjects(input);
      }),

      getProject: builder.getProject.handler(async ({ input, context }) => {
        return await services.plugins.projects(context).getProject(input);
      }),

      getProjectBySlug: builder.getProjectBySlug.handler(async ({ input, context }) => {
        return await services.plugins.projects(context).getProjectBySlug(input);
      }),

      createProject: builder.createProject.use(requireAuth).handler(async ({ input, context }) => {
        const visibility = enforceContentCreationVisibility(
          context.user,
          context.near,
          input.visibility,
        );
        return await services.plugins.projects(context).createProject({ ...input, visibility });
      }),

      updateProject: builder.updateProject.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.projects(context).updateProject(input);
      }),

      deleteProject: builder.deleteProject.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.projects(context).deleteProject(input);
      }),

      listProjectsForApp: builder.listProjectsForApp.handler(async ({ input, context }) => {
        return await services.plugins.projects(context).listProjectsForApp(input);
      }),

      listEvents: builder.listEvents.handler(async ({ input, context }) => {
        return await services.plugins.events(context).listEvents(input);
      }),

      getEvent: builder.getEvent.handler(async ({ input, context }) => {
        return await services.plugins.events(context).getEvent(input);
      }),

      getEventBySlug: builder.getEventBySlug.handler(async ({ input, context }) => {
        return await services.plugins.events(context).getEventBySlug(input);
      }),

      listEventParticipants: builder.listEventParticipants.handler(async ({ input, context }) => {
        return await services.plugins.events(context).listEventParticipants(input);
      }),

      joinEvent: builder.joinEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(context).joinEvent(input);
      }),

      leaveEvent: builder.leaveEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(context).leaveEvent(input);
      }),

      listLumaCalendars: builder.listLumaCalendars.handler(async () => {
        return await services.plugins.events().listLumaCalendars();
      }),

      listLumaEvents: builder.listLumaEvents.handler(async ({ input }) => {
        return await services.plugins.events().listLumaEvents(input);
      }),

      getLumaEvent: builder.getLumaEvent.handler(async ({ input }) => {
        return await services.plugins.events().getLumaEvent(input);
      }),

      createEvent: builder.createEvent.use(requireAuth).handler(async ({ input, context }) => {
        const visibility = enforceContentCreationVisibility(
          context.user,
          context.near,
          input.visibility,
        );
        return await services.plugins.events(context).createEvent({ ...input, visibility });
      }),

      updateEvent: builder.updateEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(context).updateEvent(input);
      }),

      deleteEvent: builder.deleteEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(context).deleteEvent(input);
      }),

      listMentions: builder.listMentions.handler(async ({ input, context }) => {
        return await services.plugins.projects(context).listMentions(input);
      }),

      listMentionedBy: builder.listMentionedBy.handler(async ({ input, context }) => {
        return await services.plugins.projects(context).listMentionedBy(input);
      }),

      listBuilders: builder.listBuilders.handler(async ({ input, context }) => {
        return await services.plugins.builders(context).listBuilders(input);
      }),

      getBuilder: builder.getBuilder.handler(async ({ input, context }) => {
        return await services.plugins.builders(context).getBuilder(input);
      }),

      getMyBuilderProfile: builder.getMyBuilderProfile
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await services.plugins.builders(context).getMyBuilderProfile(input);
        }),

      updateBuilderProfile: builder.updateBuilderProfile
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await services.plugins.builders(context).updateBuilderProfile(input);
        }),

      listRegistryApps: builder.listRegistryApps.handler(async ({ input }) => {
        return await services.plugins.apps().listRegistryApps(input);
      }),

      getRegistryAppsByAccount: builder.getRegistryAppsByAccount.handler(async ({ input }) => {
        return await services.plugins.apps().getRegistryAppsByAccount(input);
      }),

      getRegistryApp: builder.getRegistryApp.handler(async ({ input }) => {
        return await services.plugins.apps().getRegistryApp(input);
      }),

      getRegistryStatus: builder.getRegistryStatus.handler(async () => {
        return await services.plugins.apps().getRegistryStatus();
      }),

      prepareRegistryMetadataWrite: builder.prepareRegistryMetadataWrite.handler(
        async ({ input }) => {
          return await services.plugins.apps().prepareRegistryMetadataWrite(input);
        },
      ),
    };
  },
});
