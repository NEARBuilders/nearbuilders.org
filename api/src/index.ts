import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { createAuthMiddleware } from "./lib/auth";
import { type Context, ContextSchema, runEffect } from "./lib/context";
import type { PluginsClient } from "./lib/plugins-types.gen";
import { resolveBuilderStats } from "./services/builder-stats";
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

type ProposalLifecycle = {
  reviewStatus: "pending" | "approved" | "rejected" | "removed";
  applyStatus: "not_started" | "applying" | "applied" | "failed";
  removeStatus: "not_started" | "removing" | "removed" | "failed";
};

export function deriveTelegramNominationStatus(
  proposal: ProposalLifecycle,
): "under_review" | "processing" | "accepted" | "rejected" | "removed" | "processing_failed" {
  if (proposal.reviewStatus === "removed" || proposal.removeStatus === "removed") return "removed";
  if (proposal.applyStatus === "failed" || proposal.removeStatus === "failed") {
    return "processing_failed";
  }
  if (proposal.reviewStatus === "rejected") return "rejected";
  if (proposal.reviewStatus === "pending") return "under_review";
  if (proposal.applyStatus === "applying" || proposal.removeStatus === "removing") {
    return "processing";
  }
  if (proposal.reviewStatus === "approved" && proposal.applyStatus === "applied") {
    return "accepted";
  }
  return "processing";
}

export const deriveNominationStatus = deriveTelegramNominationStatus;

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
    const { notifyApproval, notifyRejection, notifyRevocation } = services.notifications;
    const activity = services.activity;
    const orchestration = services.orchestration;
    const catalogClaims = services.catalogClaims;
    const resolveNominationResponse = async (
      nomination: {
        nominationId: string;
        status: "awaiting_claim" | "awaiting_profile" | "submitted";
        joinUrl?: string;
        proposalId: string | null;
        proposalEntityId: string | null;
      },
      context: Context,
    ) => {
      if (nomination.status === "awaiting_claim") {
        return { nominationId: nomination.nominationId, status: nomination.status } as const;
      }
      if (nomination.status === "awaiting_profile") {
        if (!nomination.joinUrl) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Verified nomination is missing its onboarding URL",
          });
        }
        return {
          nominationId: nomination.nominationId,
          status: nomination.status,
          joinUrl: nomination.joinUrl,
        } as const;
      }
      if (!nomination.proposalId || !nomination.proposalEntityId) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Submitted nomination is missing its linked proposal",
        });
      }

      const proposals = await services.plugins.proposals(context).getProposals({
        pluginId: "builders",
        entityId: nomination.proposalEntityId,
        limit: 2,
      });
      const proposal = proposals.data.find((candidate) => candidate.id === nomination.proposalId);
      if (!proposal) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Linked builder proposal was not found",
        });
      }
      return {
        nominationId: nomination.nominationId,
        status: deriveTelegramNominationStatus(proposal),
      } as const;
    };

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

      createTelegramNomination: builder.createTelegramNomination.handler(
        async ({ input, context }) => {
          const response = await services.plugins.builders(context).createTelegramNomination(input);
          const body = await resolveNominationResponse(response.body, context);
          return { ...response, body };
        },
      ),

      createXNomination: builder.createXNomination.handler(async ({ input, context }) => {
        return await services.plugins.builders(context).createXNomination(input);
      }),

      claimTelegramNomination: builder.claimTelegramNomination.handler(
        async ({ input, context }) => {
          const nomination = await services.plugins
            .builders(context)
            .claimTelegramNomination(input);
          return await resolveNominationResponse(nomination, context);
        },
      ),

      submitBuilderProfile: builder.submitBuilderProfile
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const nearAccount = context.near?.primaryAccountId;
          if (!nearAccount) {
            throw new ORPCError("FORBIDDEN", {
              message: "A linked NEAR account is required to submit a builder profile",
            });
          }

          assertValidBuilderProposalAccount({
            pluginId: "builders",
            entityId: nearAccount,
          });

          const buildersClient = services.plugins.builders(context);
          const existingProfile = await buildersClient.getMyBuilderProfile({});
          if (existingProfile.data) {
            throw new ORPCError("BAD_REQUEST", {
              message: "A builder profile already exists for this NEAR account",
            });
          }

          const nominationResolution = input.nominationToken
            ? await buildersClient.resolveNomination({
                token: input.nominationToken,
                recordOpen: false,
              })
            : null;
          const nomination = nominationResolution?.status === "ready" ? nominationResolution : null;
          const proposalInput = {
            pluginId: "builders",
            entityId: nearAccount.toLowerCase(),
            payload: {
              userId: context.userId,
              name: input.name,
              bio: input.bio,
              skills: input.skills,
              location: input.location || undefined,
              links: input.links,
            },
            source: nomination?.source ?? "web",
            ...(nomination
              ? {
                  idempotencyKey: `${nomination.source}-builder-profile:${nomination.nominationId}`,
                  metadata: {
                    nominationId: nomination.nominationId,
                    source: nomination.source,
                    ...(nomination.source === "x"
                      ? {
                          referralNominationId: nomination.referralNominationId,
                          sourcePostId: nomination.referralContext?.sourcePostId ?? null,
                          nomineeXId: nomination.referralContext?.nomineeXId ?? null,
                          nominatorXId: nomination.referralContext?.nominatorXId ?? null,
                        }
                      : {}),
                  },
                }
              : {}),
          };
          const proposal = await services.plugins.proposals(context).propose(proposalInput);
          if (nomination && input.nominationToken) {
            await buildersClient.finalizeNomination({
              token: input.nominationToken,
              proposalId: proposal.data.id,
            });
          }

          return {
            ...proposal,
            nominationId: nomination?.nominationId ?? null,
          };
        }),

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

        let applied = approval;
        try {
          const appliedResourceId = await runEffect(
            Effect.tryPromise({
              try: () => orchestration.applyProposal(proposal, context),
              catch: (error) =>
                new ORPCError("INTERNAL_SERVER_ERROR", {
                  message: error instanceof Error ? error.message : String(error),
                }),
            }),
          );
          await activity.emitApproval(proposal, context);
          applied = await proposalsClient.markApplied({
            pluginId: input.pluginId,
            entityId: input.entityId,
            expectedUpdatedAt: approval.data.updatedAt,
            appliedResourceId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await proposalsClient
            .markApplyFailed({
              pluginId: input.pluginId,
              entityId: input.entityId,
              expectedUpdatedAt: approval.data.updatedAt,
              error: message,
            })
            .catch((failure) =>
              console.error("[Proposals] Could not record apply failure:", failure),
            );
          throw error;
        }

        await notifyApproval(proposal, context).catch((error) =>
          console.error("[Proposals] Approval notification failed:", error),
        );
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

      reopen: builder.reopen.use(requireAdmin).handler(async ({ input, context }) => {
        return await services.plugins.proposals(context).reopen(input);
      }),

      remove: builder.remove.use(requireAdmin).handler(async ({ input, context }) => {
        const proposalsClient = services.plugins.proposals(context);
        const started = await proposalsClient.remove(input);
        const proposalData = started.data;

        const proposal = {
          pluginId: proposalData.pluginId,
          entityId: proposalData.entityId,
          payload: proposalData.payload,
          appliedResourceId: proposalData.appliedResourceId,
          createdBy: proposalData.createdBy,
        };

        let removed = started;
        try {
          if (proposalData.applyStatus === "applied") {
            await runEffect(
              Effect.tryPromise({
                try: () => orchestration.removeProposal(proposal, context),
                catch: (error) =>
                  new ORPCError("INTERNAL_SERVER_ERROR", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
              }),
            );
          }

          removed = await proposalsClient.markRemoved({
            pluginId: input.pluginId,
            entityId: input.entityId,
            expectedUpdatedAt: proposalData.updatedAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await proposalsClient
            .markRemoveFailed({
              pluginId: input.pluginId,
              entityId: input.entityId,
              expectedUpdatedAt: proposalData.updatedAt,
              error: message,
            })
            .catch((failure) =>
              console.error("[Proposals] Could not record removal failure:", failure),
            );
          throw error;
        }

        await notifyRevocation(proposal, context).catch((error) =>
          console.error("[Proposals] Revocation notification failed:", error),
        );
        return removed;
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

      getProposalSubmissions: builder.getProposalSubmissions
        .use(requireAdmin)
        .handler(async ({ input, context }) => {
          return await services.plugins.proposals(context).getSubmissions(input);
        }),

      getReviewHistory: builder.getReviewHistory
        .use(requireAdmin)
        .handler(async ({ input, context }) => {
          return await services.plugins.proposals(context).getReviewHistory(input);
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

      listLumaEvents: builder.listLumaEvents.handler(async ({ input, context }) => {
        return await services.plugins.events(context).listLumaEvents(input);
      }),

      getLumaEvent: builder.getLumaEvent.handler(async ({ input, context }) => {
        return await services.plugins.events(context).getLumaEvent(input);
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

      getBuilderStats: builder.getBuilderStats.handler(async ({ input, context }) => {
        const [projects, ideas, feedbackRounds, githubIssues, collaborations] =
          await Promise.allSettled([
            services.plugins.projects(context).listProjects({
              ownerId: input.nearAccount,
              kind: "project",
              visibility: "public",
              limit: 1,
            }),
            services.plugins.projects(context).listProjects({
              ownerId: input.nearAccount,
              kind: "idea",
              visibility: "public",
              limit: 1,
            }),
            services.plugins.activity().getActivityFeed({
              actor: input.nearAccount,
              source: "feedback",
              limit: 1,
            }),
            services.plugins.activity().getActivityFeed({
              actor: input.nearAccount,
              source: "github",
              type: "issue",
              limit: 1,
            }),
            services.plugins.nearcatalog().listClaimedCatalogProjects({
              nearAccount: input.nearAccount,
              limit: 1,
            }),
          ]);

        return {
          data: resolveBuilderStats({
            projects,
            ideas,
            feedbackRounds,
            githubIssues,
            collaborations,
          }),
        };
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
