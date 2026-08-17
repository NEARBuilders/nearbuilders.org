import { createPlugin } from "every-plugin";
import { Effect, Exit, Cause } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract.js";
import { ContextSchema } from "./lib/context.js";
import { NostrCommentService } from "./services/nostr.js";
import { createHash } from "crypto";

// Minimal bech32 decode for nsec keys (no external deps)
function decodeBech32(str: string): Uint8Array {
  const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const words: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    const idx = CHARSET.indexOf(c);
    if (idx === -1) continue;
    words.push(idx);
  }
  // Skip separator (last word) and checksum (last 6 words)
  const data = words.slice(1, -6);
  const acc = new Uint8Array(32);
  let bits = 0;
  let acc2 = 0;
  for (const word of data) {
    acc2 = (acc2 << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      acc[acc.length - 1 - (bits / 5 | 0)] = (acc2 >>> bits) & 0xff;
    }
  }
  return acc;
}

export default createPlugin({
  variables: z.object({
    STANDARD_RELAYS: z
      .string()
      .default("wss://nos.lol,wss://relay.damus.io,wss://relay.primal.net"),
    BUZZ_RELAYS: z
      .string()
      .default("wss://nearbuilders.communities.buzz.xyz"),
    BUZZ_NSEC: z.string().optional().default(""),
  }),

  secrets: z.object({}),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const buzzNsec = config.variables.BUZZ_NSEC;
      let buzzSecretKey: Uint8Array | undefined;

      if (buzzNsec) {
        buzzSecretKey = buzzNsec.startsWith("nsec") ? decodeBech32(buzzNsec) : new Uint8Array(Buffer.from(buzzNsec, "hex"));
      }
      const service = new NostrCommentService({
        standardRelays: config.variables.STANDARD_RELAYS.split(","),
        buzzRelays: config.variables.BUZZ_RELAYS.split(","),
        buzzSecretKey,
      });

      console.log("[NostrComments] Service Initialized");
      return { service };
    }),

  shutdown: () => Effect.log("[NostrComments] Shutdown"),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
        });
      }
      return next({
        context: { ...context, userId: context.userId!, user: context.user! },
      });
    });

    return {
      listComments: builder.listComments.handler(async ({ input, errors }) => {
        try {
          if (!input.adapterType) {
            throw new ORPCError("BAD_REQUEST", {
              message: "adapterType is required",
              data: { hint: "Specify 'buzz' or 'standard'" },
            });
          }

          if (!services.service.hasAdapter(input.adapterType)) {
            throw new ORPCError("BAD_REQUEST", {
              message: `Adapter '${input.adapterType}' is not configured`,
            });
          }

          const comments = await services.service.listComments({
            target: input.target,
            targetType: input.targetType,
            adapterType: input.adapterType,
            limit: input.limit,
            since: input.since,
            enrich: input.enrich,
            requireBound: input.requireBound,
            requireVerified: input.requireVerified,
          });
          return { data: comments, meta: { count: comments.length } };
        } catch (error) {
          if (error instanceof ORPCError) throw error;
          throw errors.BAD_REQUEST({
            message: error instanceof Error ? error.message : "Could not list comments",
          });
        }
      }),

      createComment: builder.createComment
        // .use(requireAuth) // TEMP: bypass auth for testing
        .handler(async ({ input, errors }) => {
          try {
            console.log("[NOSTR-COMMENTS] createComment:", {
              target: input.target,
              targetType: input.targetType,
              adapterType: input.adapterType,
              eventId: (input.event as any)?.id?.slice(0, 12),
              pubkey: (input.event as any)?.pubkey?.slice(0, 12),
            });

            if (!input.adapterType) {
              throw new ORPCError("BAD_REQUEST", {
                message: "adapterType is required",
                data: { hint: "Specify 'buzz' or 'standard'" },
              });
            }

            if (!services.service.hasAdapter(input.adapterType)) {
              throw new ORPCError("BAD_REQUEST", {
                message: `Adapter '${input.adapterType}' is not configured`,
              });
            }

            // Ensure kind is present — Zod default(1) may not set it if sent as undefined
            const evt = { ...input.event, kind: (input.event as any).kind ?? 1 };
            const result = await services.service.publishSigned({
              event: evt,
              target: input.target,
              targetType: input.targetType,
              adapterType: input.adapterType,
            });
            console.log("[NOSTR-COMMENTS] publishResult:", {
              relayStatuses: result.statuses,
            });
            return result;
          } catch (error) {
            console.error("[NOSTR-COMMENTS] createComment error:", error);
            if (error instanceof ORPCError) throw error;
            throw errors.BAD_REQUEST({
              message: error instanceof Error ? error.message : "Could not publish comment",
            });
          }
        }),

      deleteComment: builder.deleteComment
        .use(requireAuth)
        .handler(async ({ input, errors }) => {
          throw errors.BAD_REQUEST({
            message: "Nostr events are immutable. Deletion is not supported.",
          });
        }),

      listChannels: builder.listChannels.handler(async () => {
        try {
          const channels = await services.service.listChannels("buzz");
          return { data: channels };
        } catch {
          return { data: [] };
        }
      }),

      // ── Binding ──

      getBindingChallenge: builder.getBindingChallenge
        .use(requireAuth)
        .handler(async ({ context }) => {
          const nearAccountId =
            context.near?.primaryAccountId ?? context.userId;
          if (!nearAccountId) {
            throw new ORPCError("UNAUTHORIZED", {
              message: "NEAR account required for binding",
            });
          }
          const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min
          const challenge = `bind:${nearAccountId}:${expiresAt}:nearbuilders`;
          return { challenge, expiresAt };
        }),

      verifyBindingChallenge: builder.verifyBindingChallenge
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const nearAccountId =
            context.near?.primaryAccountId ?? context.userId;

          const { verifyEvent } = await import("nostr-tools/pure");
          const event = input.event;

          if (!verifyEvent(event as any)) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Invalid Nostr event signature",
            });
          }

          const challengeTag = event.tags.find((t) => t[0] === "challenge");
          const challenge = challengeTag?.[1] ?? event.content;
          if (!challenge || !challenge.startsWith("bind:")) {
            throw new ORPCError("BAD_REQUEST", {
              message: "No binding challenge found in event",
            });
          }

          const parts = challenge.split(":");
          if (
            parts.length !== 4 ||
            parts[0] !== "bind" ||
            parts[1] !== nearAccountId
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Challenge does not match authenticated account",
            });
          }

          const expiresAt = parseInt(parts[2], 10);
          if (Math.floor(Date.now() / 1000) > expiresAt) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Challenge expired",
            });
          }

          const proof = JSON.stringify({
            nostrPubkey: event.pubkey,
            challenge,
            eventId: event.id,
            verifiedBy: nearAccountId,
            verifiedAt: Math.floor(Date.now() / 1000),
          });

          return { valid: true, nearAccountId, nostrPubkey: event.pubkey, proof };
        }),

      getBinding: builder.getBinding.handler(async ({ input }) => {
        try {
          const KV_API = "https://kv.main.fastnear.com";
          const contract = "contextual.near";
          const res = await fetch(
            `${KV_API}/v0/latest/${contract}/${input.nearAccountId}/nostr/${input.nearAccountId}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
          );
          if (!res.ok || res.status === 404) return null;
          const data = await res.json();
          const entry = data?.entries?.[0];
          if (!entry?.value) return null;
          const parsed =
            typeof entry.value === "string"
              ? JSON.parse(entry.value)
              : entry.value;
          return {
            nostrPubkey: parsed.npub ?? null,
            relay: parsed.relay ?? null,
            boundAt: parsed.bound_at ?? null,
          };
        } catch {
          return null;
        }
      }),

      // ── nostr-core: low-level relay access ──

      queryEvents: builder.queryEvents.handler(async ({ input, errors }) => {
        try {
          const service = services.service;
          if (!service.hasAdapter("standard")) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Standard adapter not configured",
            });
          }

          // Build NostrFilter from input
          const filter: Record<string, unknown> = {};
          if (input.filter.kinds) filter.kinds = input.filter.kinds;
          if (input.filter.authors) filter.authors = input.filter.authors;
          if (input.filter.ids) filter.ids = input.filter.ids;
          if (input.filter.since) filter.since = input.filter.since;
          if (input.filter.until) filter.until = input.filter.until;
          if (input.filter.limit) filter.limit = input.filter.limit;
          if (input.filter.tags) {
            for (const { tag, values } of input.filter.tags) {
              filter[`#${tag}`] = values;
            }
          }

          const events = await service.rawQuery({ filter, relays: input.relays });
          return { events };
        } catch (error) {
          if (error instanceof ORPCError) throw error;
          throw errors.BAD_REQUEST({
            message: error instanceof Error ? error.message : "Query failed",
          });
        }
      }),

      publishEvent: builder.publishEvent.handler(async ({ input, errors }) => {
        try {
          const service = services.service;
          if (!service.hasAdapter("standard")) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Standard adapter not configured",
            });
          }

          const result = await service.rawPublish({
            event: input.event as any,
            relays: input.relays,
          });
          return {
            eventId: result.eventId,
            statuses: result.statuses,
          };
        } catch (error) {
          if (error instanceof ORPCError) throw error;
          throw errors.BAD_REQUEST({
            message: error instanceof Error ? error.message : "Publish failed",
          });
        }
      }),

      getProfile: builder.getProfile.handler(async ({ input }) => {
        try {
          const service = services.service;
          const profile = await service.getProfile(input.pubkey);
          return profile;
        } catch {
          return null;
        }
      }),
    };
  },
});
