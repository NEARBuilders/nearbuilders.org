import { createPlugin } from "every-plugin";
import { Cause, Effect, Exit, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { ApplicationService, ApplicationServiceLive } from "./services/applications";
import { RequestService, RequestServiceLive } from "./services/requests";

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

const authorNearAccount = (context: {
  near?: { primaryAccountId?: string | null };
}): string | null => {
  const account = context.near?.primaryAccountId ?? null;
  return account ? account.trim().toLowerCase() : null;
};

export default createPlugin({
  variables: z.object({}),

  secrets: z.object({
    FEEDBACK_DATABASE_URL: z.string().default("pglite:.bos/feedback/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.FEEDBACK_DATABASE_URL);
      const Requests = RequestServiceLive.pipe(Layer.provide(Database));
      const Applications = ApplicationServiceLive.pipe(Layer.provide(Database));
      const requests = yield* tools.buildService(RequestService, Requests);
      const applications = yield* tools.buildService(ApplicationService, Applications);
      return { requests, applications };
    }),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Sign in with your NEAR wallet",
        });
      }
      return next({ context: { ...context, userId: context.userId!, user: context.user! } });
    });

    return {
      listFeedbackRequests: builder.listFeedbackRequests.handler(async ({ input }) => {
        const result = await runEffect(services.requests.listRequests(input));
        const counts = await runEffect(
          services.applications.countsForRequests(result.data.map((r) => r.id)),
        );
        return {
          ...result,
          data: result.data.map((r) => ({
            ...r,
            applicationCounts: counts.get(r.id) ?? { pending: 0, selected: 0 },
          })),
        };
      }),

      getFeedbackRequest: builder.getFeedbackRequest.handler(async ({ input }) => {
        const result = await runEffect(services.requests.getRequest(input.id));
        const counts = await runEffect(
          services.applications.countApplicationsForRequest(result.data.id),
        );
        return { data: { ...result.data, applicationCounts: counts } };
      }),

      createFeedbackRequest: builder.createFeedbackRequest
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to post feedback requests",
              data: { action: "createFeedbackRequest" },
            });
          }
          return await runEffect(
            services.requests.createRequest({
              ...input,
              ownerNearAccount: account,
            }),
          );
        }),

      listFeedbackApplications: builder.listFeedbackApplications.handler(
        async ({ input }) => await runEffect(services.applications.listApplications(input)),
      ),

      applyToFeedbackRequest: builder.applyToFeedbackRequest
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to apply",
              data: { action: "applyToFeedbackRequest" },
            });
          }
          return await runEffect(
            services.applications.applyToRequest({
              requestId: input.requestId,
              applicantNearAccount: account,
              note: input.note,
            }),
          );
        }),

      withdrawFeedbackApplication: builder.withdrawFeedbackApplication
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to withdraw",
              data: { action: "withdrawFeedbackApplication" },
            });
          }
          return await runEffect(services.applications.withdrawApplication(input.id, account));
        }),

      selectFeedbackApplicant: builder.selectFeedbackApplicant
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to select applicants",
              data: { action: "selectFeedbackApplicant" },
            });
          }
          return await runEffect(services.applications.selectApplicant(input.id, account));
        }),

      rejectFeedbackApplicant: builder.rejectFeedbackApplicant
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to reject applicants",
              data: { action: "rejectFeedbackApplicant" },
            });
          }
          return await runEffect(services.applications.rejectApplicant(input.id, account));
        }),

      attachFiledIssue: builder.attachFiledIssue
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to file issues",
              data: { action: "attachFiledIssue" },
            });
          }
          return await runEffect(
            services.applications.attachFiledIssue(input.id, account, input.url, input.title),
          );
        }),

      removeFiledIssue: builder.removeFiledIssue
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to remove filed issues",
              data: { action: "removeFiledIssue" },
            });
          }
          return await runEffect(
            services.applications.removeFiledIssue(input.id, account, input.url),
          );
        }),

      markFeedbackRequestComplete: builder.markFeedbackRequestComplete
        .use(requireAuth)
        .handler(async ({ input, context, errors }) => {
          const account = authorNearAccount(context);
          if (!account) {
            throw errors.FORBIDDEN({
              message: "Link a NEAR wallet to mark complete",
              data: { action: "markFeedbackRequestComplete" },
            });
          }
          const result = await runEffect(services.requests.markComplete(input.id, account));
          const counts = await runEffect(
            services.applications.countApplicationsForRequest(result.data.id),
          );
          return { data: { ...result.data, applicationCounts: counts } };
        }),
    };
  },
});
