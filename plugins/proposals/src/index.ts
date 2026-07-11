import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract, type ProposalEventSchema } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ProposalService, ProposalServiceLive } from "./services/proposals";

type ProposalEvent = z.infer<typeof ProposalEventSchema>;

type ProposalEvents = {
  proposal: ProposalEvent;
};

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

export default createPlugin({
  variables: z.object({
    privatePluginIds: z.array(z.string().min(1).max(100)).default([]),
  }),

  secrets: z.object({
    PROPOSALS_DATABASE_URL: z.string().default("pglite:.bos/proposals/:memory:"),
  }),

  context: z.object({
    userId: z.string().optional(),
    walletAddress: z.string().optional(),
    user: z
      .object({
        id: z.string(),
        role: z.string().optional(),
        email: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    apiKey: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        permissions: z.record(z.string(), z.array(z.string())).nullable(),
      })
      .optional(),
    allowPrivateSubmission: z.boolean().optional(),
    resubmissionPolicy: z.enum(["rejected-only"]).optional(),
    reqHeaders: z.custom<Headers>().optional(),
    getRawBody: z.custom<() => Promise<string>>().optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.PROPOSALS_DATABASE_URL);
      const ProposalServices = ProposalServiceLive.pipe(Layer.provide(Database));
      const proposal = yield* Effect.provide(ProposalService, ProposalServices);
      const publisher = new MemoryPublisher<ProposalEvents>({ resumeRetentionSeconds: 120 });

      console.log("[Proposals] Services Initialized");
      return {
        proposal,
        publisher,
        privatePluginIds: new Set(config.variables.privatePluginIds),
      };
    }),

  shutdown: () => Effect.log("[Proposals] Shutdown"),

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

    const requireAuthOrApiKey = builder.middleware(async ({ context, next }) => {
      if (!context.user && !context.userId && !context.apiKey) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: { hint: "Sign in or provide an API key" },
        });
      }
      return next({ context });
    });

    const viewerId = (context: {
      walletAddress?: string;
      userId?: string;
      apiKey?: { id: string };
    }) => context.walletAddress ?? context.userId ?? context.apiKey?.id;

    const proposalScope = (context: {
      walletAddress?: string;
      userId?: string;
      user?: { role?: string };
      apiKey?: { id: string };
    }) => ({
      privatePluginIds: Array.from(services.privatePluginIds),
      viewerId: viewerId(context),
      isAdmin: context.user?.role === "admin",
    });

    const canReadProposal = async (
      context: {
        walletAddress?: string;
        userId?: string;
        user?: { role?: string };
        apiKey?: { id: string };
      },
      pluginId: string,
      entityId: string,
    ) => {
      if (!services.privatePluginIds.has(pluginId) || context.user?.role === "admin") return true;
      const scoped = await runEffect(
        services.proposal.getProposals({
          pluginId,
          entityId,
          limit: 1,
          ...proposalScope(context),
        }),
      );
      return scoped.data.length > 0;
    };

    const publishProposalEvent = async (action: string, proposal: any) => {
      await services.publisher.publish("proposal", {
        action,
        pluginId: proposal.pluginId,
        entityId: proposal.entityId,
        reviewStatus: proposal.reviewStatus,
        applyStatus: proposal.applyStatus,
        removeStatus: proposal.removeStatus,
        submissionCount: proposal.submissionCount,
        timestamp: new Date().toISOString(),
      });
    };

    return {
      propose: builder.propose.use(requireAuthOrApiKey).handler(async ({ input, context }) => {
        if (services.privatePluginIds.has(input.pluginId) && !context.allowPrivateSubmission) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Use the plugin's dedicated proposal endpoint",
          });
        }
        const actorId = context.walletAddress ?? context.userId ?? context.apiKey?.id ?? "unknown";
        const result = await runEffect(
          services.proposal.propose({
            ...input,
            actorId,
            actor: context.user,
            resubmissionPolicy: context.resubmissionPolicy,
          }),
        );
        await publishProposalEvent("proposed", result);
        return { data: result };
      }),

      approve: builder.approve.use(requireAdmin).handler(async ({ input, context }) => {
        const result = await runEffect(
          services.proposal.approve({
            ...input,
            actorId: context.userId!,
            actor: context.user,
          }),
        );
        await publishProposalEvent("approved", result);
        return { data: result };
      }),

      reject: builder.reject.use(requireAdmin).handler(async ({ input, context }) => {
        const result = await runEffect(
          services.proposal.reject({
            ...input,
            actorId: context.userId!,
            actor: context.user,
          }),
        );
        await publishProposalEvent("rejected", result);
        return { data: result };
      }),

      remove: builder.remove.use(requireAdmin).handler(async ({ input, context }) => {
        const result = await runEffect(
          services.proposal.remove({
            ...input,
            actorId: context.userId!,
            actor: context.user,
          }),
        );
        await publishProposalEvent("removed", result);
        return { data: result };
      }),

      markApplied: builder.markApplied.use(requireAdmin).handler(async ({ input }) => {
        const result = await runEffect(services.proposal.markApplied(input));
        await publishProposalEvent("applied", result);
        return { data: result };
      }),

      markApplyFailed: builder.markApplyFailed.use(requireAdmin).handler(async ({ input }) => {
        const result = await runEffect(services.proposal.markApplyFailed(input));
        await publishProposalEvent("apply_failed", result);
        return { data: result };
      }),

      markRemoved: builder.markRemoved.use(requireAdmin).handler(async ({ input }) => {
        const result = await runEffect(services.proposal.markRemoved(input));
        await publishProposalEvent("removed", result);
        return { data: result };
      }),

      markRemoveFailed: builder.markRemoveFailed.use(requireAdmin).handler(async ({ input }) => {
        const result = await runEffect(services.proposal.markRemoveFailed(input));
        await publishProposalEvent("remove_failed", result);
        return { data: result };
      }),

      getProposals: builder.getProposals.handler(async ({ input, context }) => {
        return await runEffect(
          services.proposal.getProposals({ ...input, ...proposalScope(context) }),
        );
      }),

      getProposalCount: builder.getProposalCount.handler(async ({ input, context }) => {
        if (!(await canReadProposal(context, input.pluginId, input.entityId))) {
          return { ...input, totalCount: 0 };
        }
        return await runEffect(services.proposal.getProposalCount(input));
      }),

      getAuditLog: builder.getAuditLog.handler(async ({ input, context }) => {
        if (!(await canReadProposal(context, input.pluginId, input.entityId))) {
          return { data: [] };
        }
        return await runEffect(services.proposal.getAuditLog(input));
      }),

      subscribe: builder.subscribe.handler(async function* ({
        input,
        context,
        signal,
        lastEventId,
      }) {
        const iterator = services.publisher.subscribe("proposal", { signal, lastEventId });
        for await (const event of iterator) {
          if (input.pluginId && event.pluginId !== input.pluginId) continue;
          if (input.entityId && event.entityId !== input.entityId) continue;
          if (!(await canReadProposal(context, event.pluginId, event.entityId))) continue;
          yield event;
        }
      }),
    };
  },
});
