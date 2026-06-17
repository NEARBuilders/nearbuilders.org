import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { AccountIdSchema } from "near-kit/schemas";
import type { ProposalSchema } from "../../plugins/proposals/src/contract";
import { contract } from "./contract";
import { createAuthMiddleware } from "./lib/auth";
import type { PluginsClient } from "./lib/plugins-types.gen";
import {
  assertProjectProposalOwner,
  createProjectProposalOwnerContext,
  resolveProjectProposalOwner,
} from "./lib/project-proposal-owner";

type ApiContext = {
  userId?: string;
  walletAddress?: string;
  user?: {
    id: string;
    role?: string;
    email?: string;
    name?: string;
  };
  organizationId?: string;
  apiKey?: {
    id: string;
    name: string | null;
    permissions: Record<string, string[]> | null;
  };
  reqHeaders?: Headers;
  getRawBody?: () => Promise<string>;
};

type ProposalData = Pick<
  z.infer<typeof ProposalSchema>,
  "pluginId" | "entityId" | "payload" | "appliedResourceId" | "createdBy"
>;

function pluginContext(context: ApiContext) {
  return {
    userId: context.userId,
    walletAddress: context.walletAddress,
    user: context.user,
    organizationId: context.organizationId,
    apiKey: context.apiKey,
    reqHeaders: context.reqHeaders,
    getRawBody: context.getRawBody,
  };
}

function requireObjectPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ORPCError("BAD_REQUEST", { message: "Proposal payload must be an object" });
  }
  return payload as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function htmlDecode(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function asIso(value: unknown) {
  if (typeof value !== "string") return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function readLumaLocation(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const location = value as { name?: unknown; address?: unknown };
  return readString(location.name) ?? readString(location.address);
}

async function fetchLumaEvent(url: string) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, "");
  if (parsed.protocol !== "https:" || (hostname !== "luma.com" && hostname !== "lu.ma")) {
    throw new ORPCError("BAD_REQUEST", { message: "Enter a valid Luma URL" });
  }

  const response = await fetch(parsed.toString(), {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new ORPCError("BAD_REQUEST", { message: "Could not fetch Luma event" });
  }

  const html = await response.text();
  const match = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) {
    throw new ORPCError("BAD_REQUEST", { message: "Could not find event details on Luma page" });
  }

  let data: {
    "@type"?: unknown;
    name?: unknown;
    description?: unknown;
    url?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    location?: unknown;
  };
  try {
    data = JSON.parse(htmlDecode(match[1]));
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "Could not read event details on Luma page" });
  }

  if (data["@type"] !== "Event") {
    throw new ORPCError("BAD_REQUEST", { message: "Luma URL is not an event" });
  }

  const description = readString(data.description);
  return {
    title: readString(data.name),
    description,
    lumaUrl: readString(data.url) ?? parsed.toString(),
    startAt: asIso(data.startDate),
    endAt: asIso(data.endDate),
    location: readLumaLocation(data.location),
  };
}

const IMPLICIT_ACCOUNT_ID_RE = /^[0-9a-f]{64}$/;

function assertValidBuilderProposalAccount(input: { pluginId: string; entityId: string }) {
  if (input.pluginId !== "builders") return;

  if (!AccountIdSchema.safeParse(input.entityId).success) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Invalid NEAR account ID",
    });
  }

  if (IMPLICIT_ACCOUNT_ID_RE.test(input.entityId)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Builder nominations require a named NEAR account ID",
    });
  }
}

function isNotFoundError(error: unknown): boolean {
  if (error instanceof ORPCError) return error.code === "NOT_FOUND";
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "NOT_FOUND"
  );
}

type CreateCallback = (
  plugins: Omit<PluginsClient, "auth">,
  proposal: ProposalData,
  context: ApiContext,
) => Promise<string>;

type RemoveCallback = (
  plugins: Omit<PluginsClient, "auth">,
  proposal: ProposalData,
  context: ApiContext,
) => Promise<void>;

const createCallbacks: Record<string, CreateCallback> = {
  builders: async (plugins, proposal, context) => {
    const payload = requireObjectPayload(proposal.payload);
    const result = await plugins.builders(pluginContext(context)).createBuilder({
      nearAccount: proposal.entityId,
      userId: readString(payload.userId),
      name: readString(payload.name),
      bio: readString(payload.bio),
      skills: readStringArray(payload.skills),
      location: readString(payload.location),
      links:
        payload.links && typeof payload.links === "object" && !Array.isArray(payload.links)
          ? (payload.links as Record<string, string>)
          : undefined,
    });
    return result.data.nearAccount;
  },
  projects: async (plugins, proposal, context) => {
    const payload = requireObjectPayload(proposal.payload);
    const ownerId = resolveProjectProposalOwner(payload, proposal.createdBy);
    const projectsClient = plugins.projects(pluginContext(context));
    const visibility =
      payload.visibility === "private" || payload.visibility === "unlisted"
        ? payload.visibility
        : "public";

    try {
      const updated = await projectsClient.updateProject({
        id: proposal.entityId,
        visibility,
      });
      assertProjectProposalOwner(updated.ownerId, ownerId);
      return updated.id;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    const proposalOwnerContext = createProjectProposalOwnerContext(context, ownerId);
    const result = await plugins.projects(pluginContext(proposalOwnerContext)).createProject({
      id: proposal.entityId,
      kind: payload.kind === "idea" ? "idea" : "project",
      title: readString(payload.title) ?? proposal.entityId,
      slug: readString(payload.slug) ?? proposal.entityId,
      description: readString(payload.description),
      content: readString(payload.content),
      visibility,
      repository: readString(payload.repository),
      organizationId: readString(payload.organizationId),
      domain: readString(payload.domain),
    });
    assertProjectProposalOwner(result.ownerId, ownerId);
    return result.id;
  },
  events: async (plugins, proposal, context) => {
    const payload = requireObjectPayload(proposal.payload);
    const ownerId = readString(payload.ownerId) ?? proposal.createdBy;
    const eventsClient = plugins.events(pluginContext(context));
    const visibility =
      payload.visibility === "private" || payload.visibility === "unlisted"
        ? payload.visibility
        : "public";

    try {
      const updated = await eventsClient.updateEvent({
        id: proposal.entityId,
        visibility,
      });
      if (updated.ownerId !== ownerId) {
        throw new ORPCError("FORBIDDEN", { message: "Event proposal owner mismatch" });
      }
      return updated.id;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }

    const result = await plugins.events(pluginContext(context)).createEvent({
      id: proposal.entityId,
      title: readString(payload.title) ?? proposal.entityId,
      slug: readString(payload.slug) ?? proposal.entityId,
      description: readString(payload.description),
      content: readString(payload.content),
      visibility,
      lumaUrl: readString(payload.lumaUrl),
      startAt: readString(payload.startAt) ?? new Date().toISOString(),
      endAt: readString(payload.endAt),
      location: readString(payload.location),
      ownerId,
    });
    return result.id;
  },
};

const removeCallbacks: Record<string, RemoveCallback> = {
  builders: async (plugins, proposal, context) => {
    await plugins.builders(pluginContext(context)).deleteBuilder({
      nearAccount: proposal.entityId,
    });
  },
  projects: async (plugins, proposal, context) => {
    const projectId = proposal.appliedResourceId ?? proposal.entityId;
    // The project is the owner's personal project that predates the proposal,
    // so removing the approval un-publishes it instead of deleting it.
    try {
      await plugins.projects(pluginContext(context)).updateProject({
        id: projectId,
        visibility: "private",
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  },
  events: async (plugins, proposal, context) => {
    const eventId = proposal.appliedResourceId ?? proposal.entityId;
    try {
      await plugins.events(pluginContext(context)).updateEvent({
        id: eventId,
        visibility: "private",
      });
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
  },
};

export default createPlugin.withPlugins<PluginsClient>()({
  variables: z.object({}),

  secrets: z.object({
    API_DATABASE_URL: z.string().default("pglite:.bos/api/:memory:"),
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
    organizationId: z.string().optional(),
    apiKey: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        permissions: z.record(z.string(), z.array(z.string())).nullable(),
      })
      .optional(),
    reqHeaders: z.custom<Headers>().optional(),
    getRawBody: z.custom<() => Promise<string>>().optional(),
  }),

  contract,

  initialize: (_config, plugins) =>
    Effect.sync(() => {
      const { auth, ...restPlugins } = plugins;
      console.log("[API] Services Initialized");
      console.log("[API] Auth client available:", Boolean(auth));
      console.log("[API] Plugins available:", Object.keys(restPlugins).join(", ") || "none");
      return { auth, plugins: restPlugins };
    }),

  shutdown: () => Effect.log("[API] Shutdown"),

  createRouter: (services, builder) => {
    const { requireAuth, requireAdmin, requireAuthOrApiKey } = createAuthMiddleware(builder);

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
        assertValidBuilderProposalAccount(input);
        return await services.plugins.proposals(pluginContext(context)).propose(input);
      }),

      approve: builder.approve.use(requireAdmin).handler(async ({ input, context }) => {
        const proposalsClient = services.plugins.proposals(pluginContext(context));
        const approval = await proposalsClient.approve(input);
        const proposal: ProposalData = {
          pluginId: approval.data.pluginId,
          entityId: approval.data.entityId,
          payload: approval.data.payload,
          appliedResourceId: approval.data.appliedResourceId,
          createdBy: approval.data.createdBy,
        };

        if (approval.data.applyStatus === "applied") {
          return approval;
        }

        const createCallback = createCallbacks[proposal.pluginId];
        if (!createCallback) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Unsupported pluginId: ${proposal.pluginId}`,
          });
        }

        const applyAttempt = Effect.tryPromise({
          try: async () => await createCallback(services.plugins, proposal, context),
          catch: (error) =>
            new ORPCError("INTERNAL_SERVER_ERROR", {
              message: error instanceof Error ? error.message : String(error),
            }),
        });

        let appliedResourceId: string;
        try {
          appliedResourceId = await Effect.runPromise(applyAttempt);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await proposalsClient.markApplyFailed({
            pluginId: input.pluginId,
            entityId: input.entityId,
            error: message,
          });
          throw error;
        }

        return await proposalsClient.markApplied({
          pluginId: input.pluginId,
          entityId: input.entityId,
          appliedResourceId,
        });
      }),

      reject: builder.reject.use(requireAdmin).handler(async ({ input, context }) => {
        return await services.plugins.proposals(pluginContext(context)).reject(input);
      }),

      remove: builder.remove.use(requireAdmin).handler(async ({ input, context }) => {
        const proposalsClient = services.plugins.proposals(pluginContext(context));
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

        const proposal: ProposalData = {
          pluginId: proposalData.pluginId,
          entityId: proposalData.entityId,
          payload: proposalData.payload,
          appliedResourceId: proposalData.appliedResourceId,
          createdBy: proposalData.createdBy,
        };

        if (proposalData.applyStatus === "applied") {
          const removeCallback = removeCallbacks[proposal.pluginId];
          if (!removeCallback) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Unsupported pluginId: ${proposal.pluginId}`,
            });
          }

          const removeAttempt = Effect.tryPromise({
            try: async () => await removeCallback(services.plugins, proposal, context),
            catch: (error) =>
              new ORPCError("INTERNAL_SERVER_ERROR", {
                message: error instanceof Error ? error.message : String(error),
              }),
          });

          try {
            await Effect.runPromise(removeAttempt);
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

      getProposals: builder.getProposals.handler(async ({ input }) => {
        return await services.plugins.proposals().getProposals(input);
      }),

      getProposalCount: builder.getProposalCount.handler(async ({ input }) => {
        return await services.plugins.proposals().getProposalCount(input);
      }),

      getAuditLog: builder.getAuditLog.handler(async ({ input }) => {
        return await services.plugins.proposals().getAuditLog(input);
      }),

      subscribeProposals: builder.subscribeProposals.handler(async function* ({ input }) {
        const iterator = await services.plugins.proposals().subscribe(input);
        for await (const event of iterator) {
          yield event;
        }
      }),

      upvote: builder.upvote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(pluginContext(context)).upvote(input);
      }),

      downvote: builder.downvote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(pluginContext(context)).downvote(input);
      }),

      getUpvoteCount: builder.getUpvoteCount.handler(async ({ input }) => {
        return await services.plugins.votes().getUpvoteCount(input);
      }),

      getUserVote: builder.getUserVote.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(pluginContext(context)).getUserVote(input);
      }),

      getUserVotes: builder.getUserVotes.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.votes(pluginContext(context)).getUserVotes(input);
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

      listProjects: builder.listProjects.handler(async ({ input, context }) => {
        try {
          return await services.plugins.projects(pluginContext(context)).listProjects(input);
        } catch (err) {
          console.error(
            "[API] listProjects failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      getProject: builder.getProject.handler(async ({ input, context }) => {
        try {
          return await services.plugins.projects(pluginContext(context)).getProject(input);
        } catch (err) {
          console.error(
            "[API] getProject failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      createProject: builder.createProject.use(requireAuth).handler(async ({ input, context }) => {
        const isAdmin = context.user?.role === "admin";
        if (!isAdmin && !context.walletAddress) {
          throw new ORPCError("FORBIDDEN", {
            message: "Link a NEAR account to create projects",
          });
        }
        // Non-admin projects always start out non-public; going public requires
        // an approved proposal.
        const visibility =
          !isAdmin && input.visibility === "public" ? "private" : (input.visibility ?? "private");
        try {
          return await services.plugins.projects(pluginContext(context)).createProject({
            ...input,
            visibility,
          });
        } catch (err) {
          console.error(
            "[API] createProject failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      updateProject: builder.updateProject.use(requireAuth).handler(async ({ input, context }) => {
        try {
          return await services.plugins.projects(pluginContext(context)).updateProject(input);
        } catch (err) {
          console.error(
            "[API] updateProject failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      deleteProject: builder.deleteProject.use(requireAuth).handler(async ({ input, context }) => {
        try {
          return await services.plugins.projects(pluginContext(context)).deleteProject(input);
        } catch (err) {
          console.error(
            "[API] deleteProject failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      listProjectsForApp: builder.listProjectsForApp.handler(async ({ input, context }) => {
        try {
          return await services.plugins.projects(pluginContext(context)).listProjectsForApp(input);
        } catch (err) {
          console.error(
            "[API] listProjectsForApp failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      listEvents: builder.listEvents.handler(async ({ input, context }) => {
        return await services.plugins.events(pluginContext(context)).listEvents(input);
      }),

      getEvent: builder.getEvent.handler(async ({ input, context }) => {
        return await services.plugins.events(pluginContext(context)).getEvent(input);
      }),

      listEventParticipants: builder.listEventParticipants.handler(async ({ input, context }) => {
        return await services.plugins.events(pluginContext(context)).listEventParticipants(input);
      }),

      joinEvent: builder.joinEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(pluginContext(context)).joinEvent(input);
      }),

      leaveEvent: builder.leaveEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(pluginContext(context)).leaveEvent(input);
      }),

      fetchLumaEvent: builder.fetchLumaEvent.handler(async ({ input }) => ({
        data: await fetchLumaEvent(input.url),
      })),

      createEvent: builder.createEvent.use(requireAuth).handler(async ({ input, context }) => {
        const isAdmin = context.user?.role === "admin";
        if (!isAdmin && !context.walletAddress) {
          throw new ORPCError("FORBIDDEN", {
            message: "Link a NEAR account to create events",
          });
        }
        const visibility =
          !isAdmin && input.visibility === "public" ? "private" : (input.visibility ?? "private");
        return await services.plugins.events(pluginContext(context)).createEvent({
          ...input,
          visibility,
        });
      }),

      updateEvent: builder.updateEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(pluginContext(context)).updateEvent(input);
      }),

      deleteEvent: builder.deleteEvent.use(requireAuth).handler(async ({ input, context }) => {
        return await services.plugins.events(pluginContext(context)).deleteEvent(input);
      }),

      listMentions: builder.listMentions.handler(async ({ input, context }) => {
        try {
          return await services.plugins.projects(pluginContext(context)).listMentions(input);
        } catch (err) {
          console.error(
            "[API] listMentions failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      listMentionedBy: builder.listMentionedBy.handler(async ({ input, context }) => {
        try {
          return await services.plugins.projects(pluginContext(context)).listMentionedBy(input);
        } catch (err) {
          console.error(
            "[API] listMentionedBy failed:",
            err instanceof Error ? err.message : String(err),
          );
          throw err;
        }
      }),

      listBuilders: builder.listBuilders.handler(async ({ input, context }) => {
        return await services.plugins.builders(pluginContext(context)).listBuilders(input);
      }),

      getBuilder: builder.getBuilder.handler(async ({ input, context }) => {
        return await services.plugins.builders(pluginContext(context)).getBuilder(input);
      }),

      getMyBuilderProfile: builder.getMyBuilderProfile
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await services.plugins.builders(pluginContext(context)).getMyBuilderProfile(input);
        }),

      updateBuilderProfile: builder.updateBuilderProfile
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          return await services.plugins
            .builders(pluginContext(context))
            .updateBuilderProfile(input);
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
