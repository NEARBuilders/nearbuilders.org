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
  variables: z.object({}),

  secrets: z.object({
    PROPOSALS_DATABASE_URL: z.string().default("pglite:.bos/proposals/:memory:"),
  }),

  context: z.object({
    userId: z.string().optional(),
    user: z
      .object({
        id: z.string(),
        role: z.string().optional(),
        email: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
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
      return { proposal, publisher };
    }),

  shutdown: () => Effect.log("[Proposals] Shutdown"),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      return next({ context });
    });

    const requireAdmin = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" });
      }
      if (context.user.role !== "admin") {
        throw new ORPCError("FORBIDDEN", { message: "Admin access required" });
      }
      return next({ context });
    });

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
      propose: builder.propose.use(requireAuth).handler(async ({ input, context }) => {
        const result = await runEffect(
          services.proposal.propose({
            ...input,
            actorId: context.userId!,
            actor: context.user,
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

      getProposals: builder.getProposals.handler(async ({ input }) => {
        return await runEffect(services.proposal.getProposals(input));
      }),

      getProposalCount: builder.getProposalCount.handler(async ({ input }) => {
        return await runEffect(services.proposal.getProposalCount(input));
      }),

      getAuditLog: builder.getAuditLog.handler(async ({ input }) => {
        return await runEffect(services.proposal.getAuditLog(input));
      }),

      subscribe: builder.subscribe.handler(async function* ({ input, signal, lastEventId }) {
        const iterator = services.publisher.subscribe("proposal", { signal, lastEventId });
        for await (const event of iterator) {
          if (input.pluginId && event.pluginId !== input.pluginId) continue;
          if (input.entityId && event.entityId !== input.entityId) continue;
          yield event;
        }
      }),
    };
  },
});
