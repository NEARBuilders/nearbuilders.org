import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const NostrCommentOutput = z.object({
  id: z.string(),
  pubkey: z.string(),
  content: z.string(),
  target: z.string(),
  targetType: z.string(),
  nearAccountId: z.string().optional().nullable(),
  parentEventId: z.string().optional().nullable(),
  createdAt: z.number().int(),
  tags: z.array(z.array(z.string())).optional(),
  source: z.enum(["standard", "buzz"]),
  profile: z
    .object({
      name: z.string().optional().nullable(),
      picture: z.string().optional().nullable(),
      about: z.string().optional().nullable(),
      nip05: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const RelayStatusOutput = z.object({
  relay: z.string(),
  success: z.boolean(),
});

const PublishResultOutput = z.object({
  eventId: z.string(),
  statuses: z.array(RelayStatusOutput),
});

export const contract = oc.router({
  listComments: oc
    .route({ method: "GET", path: "/v1/comments" })
    .input(
      z.object({
        target: z.string().min(1),
        targetType: z.string().default("project"),
        adapterType: z.enum(["standard", "buzz"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        since: z.number().int().optional(),
        enrich: z.boolean().optional(),
        requireBound: z.boolean().optional(),
        requireVerified: z.boolean().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(NostrCommentOutput),
        meta: z.object({ count: z.number().int() }),
      }),
    )
    .errors({ BAD_REQUEST }),

  createComment: oc
    .route({ method: "POST", path: "/v1/comments" })
    .input(
      z.object({
        event: z.object({
          id: z.string(),
          pubkey: z.string(),
          kind: z.number().int().default(1111),
          content: z.string(),
          tags: z.array(z.array(z.string())),
          created_at: z.number().int(),
          sig: z.string(),
        }),
        target: z.string().min(1),
        targetType: z.string().default("project"),
        adapterType: z.enum(["standard", "buzz"]).optional(),
      }),
    )
    .output(PublishResultOutput)
    .errors({ BAD_REQUEST }), // TEMP: removed UNAUTHORIZED for testing

  deleteComment: oc
    .route({ method: "DELETE", path: "/v1/comments/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ deleted: z.boolean() }))
    .errors({ UNAUTHORIZED, NOT_FOUND, BAD_REQUEST }),

  listChannels: oc
    .route({ method: "GET", path: "/v1/channels" })
    .output(
      z.object({
        data: z.array(
          z.object({
            id: z.string(),
            name: z.string().optional().nullable(),
            members: z.number().int().optional().nullable(),
          }),
        ),
      }),
    ),

  // ── Binding: NEAR account ↔ Nostr pubkey ──

  getBindingChallenge: oc
    .route({ method: "POST", path: "/v1/binding/challenge" })
    .input(z.object({}))
    .output(
      z.object({
        challenge: z.string(),
        expiresAt: z.number().int(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  verifyBindingChallenge: oc
    .route({ method: "POST", path: "/v1/binding/verify" })
    .input(
      z.object({
        event: z.object({
          id: z.string(),
          pubkey: z.string(),
          kind: z.number().int().default(1111),
          content: z.string(),
          tags: z.array(z.array(z.string())),
          created_at: z.number().int(),
          sig: z.string(),
        }),
      }),
    )
    .output(
      z.object({
        valid: z.boolean(),
        nearAccountId: z.string(),
        nostrPubkey: z.string(),
        proof: z.string(),
      }),
    )
    .errors({ UNAUTHORIZED, BAD_REQUEST }),

  getBinding: oc
    .route({ method: "GET", path: "/v1/binding/{nearAccountId}" })
    .input(z.object({ nearAccountId: z.string().min(1) }))
    .output(
      z.object({
        nostrPubkey: z.string().optional().nullable(),
        relay: z.string().optional().nullable(),
        boundAt: z.number().int().optional().nullable(),
      }).nullable(),
    )
    .errors({ BAD_REQUEST }),

  // ── nostr-core: low-level relay access for agents/custom clients ──

  queryEvents: oc
    .route({ method: "POST", path: "/v1/nostr/query" })
    .input(
      z.object({
        filter: z.object({
          kinds: z.array(z.number().int()).optional(),
          authors: z.array(z.string()).optional(),
          ids: z.array(z.string()).optional(),
          since: z.number().int().optional(),
          until: z.number().int().optional(),
          limit: z.number().int().min(1).max(500).optional(),
          tags: z.array(z.object({ tag: z.string(), values: z.array(z.string()) })).optional(),
        }),
        relays: z.array(z.string()).optional(),
      }),
    )
    .output(
      z.object({
        events: z.array(
          z.object({
            id: z.string(),
            pubkey: z.string(),
            created_at: z.number().int(),
            kind: z.number().int(),
            tags: z.array(z.array(z.string())),
            content: z.string(),
            sig: z.string(),
          }),
        ),
      }),
    )
    .errors({ BAD_REQUEST }),

  publishEvent: oc
    .route({ method: "POST", path: "/v1/nostr/publish" })
    .input(
      z.object({
        event: z.object({
          id: z.string(),
          pubkey: z.string(),
          created_at: z.number().int(),
          kind: z.number().int(),
          tags: z.array(z.array(z.string())),
          content: z.string(),
          sig: z.string(),
        }),
        relays: z.array(z.string()).optional(),
      }),
    )
    .output(PublishResultOutput)
    .errors({ BAD_REQUEST }),

  getProfile: oc
    .route({ method: "GET", path: "/v1/nostr/profile/{pubkey}" })
    .input(z.object({ pubkey: z.string().min(1) }))
    .output(
      z.object({
        pubkey: z.string(),
        name: z.string().optional().nullable(),
        picture: z.string().optional().nullable(),
        about: z.string().optional().nullable(),
        nip05: z.string().optional().nullable(),
        website: z.string().optional().nullable(),
      }).nullable(),
    )
    .errors({ BAD_REQUEST }),
});

export type ContractType = typeof contract;
