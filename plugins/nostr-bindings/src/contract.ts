import { BAD_REQUEST, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

// ── Binding types ──

const BindingOutput = z.object({
  npub: z.string(),
  relay: z.string(),
  proof: z.string(),
  boundAt: z.number().int(),
});

const IdentityOutput = z.object({
  nearAccountId: z.string(),
  nostrPubkey: z.string(),
  relay: z.string(),
  proof: z.string(),
  boundAt: z.number().int(),
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

// ── Contract ──

export const contract = oc.router({
  // Get binding for a NEAR account from FastNear KV
  getBinding: oc
    .route({ method: "GET", path: "/v1/binding/{nearAccountId}" })
    .input(z.object({ nearAccountId: z.string().min(1) }))
    .output(BindingOutput.nullable())
    .errors({ BAD_REQUEST }),

  // Resolve full identity: binding + Nostr kind-0 profile
  getIdentity: oc
    .route({ method: "GET", path: "/v1/identity/{nearAccountId}" })
    .input(
      z.object({
        nearAccountId: z.string().min(1),
        enrichProfile: z.boolean().optional().default(true),
      }),
    )
    .output(IdentityOutput.nullable())
    .errors({ BAD_REQUEST }),

  // Generate a binding challenge for the authenticated user
  createChallenge: oc
    .route({ method: "POST", path: "/v1/binding/challenge" })
    .input(z.object({}))
    .output(
      z.object({
        challenge: z.string(),
        expiresAt: z.number().int(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  // Verify a signed Nostr binding event
  verifyBinding: oc
    .route({ method: "POST", path: "/v1/binding/verify" })
    .input(
      z.object({
        event: z.object({
          id: z.string(),
          pubkey: z.string(),
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

  // Prepare binding write args for client-side wallet tx
  prepareBindingWrite: oc
    .route({ method: "POST", path: "/v1/binding/prepare" })
    .input(
      z.object({
        nostrPubkey: z.string(),
        relay: z.string(),
        proof: z.string(),
      }),
    )
    .output(
      z.object({
        contractId: z.string(),
        methodName: z.literal("__fastdata_kv"),
        key: z.string(),
        value: z.string(),
        args: z.record(z.string(), z.string()),
        gas: z.string(),
        attachedDeposit: z.string(),
      }),
    )
    .errors({ BAD_REQUEST }),
});

export type ContractType = typeof contract;
