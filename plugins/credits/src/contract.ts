import "@orpc/openapi/extensions/route";
import { oc } from "@orpc/contract";
import {
  BAD_REQUEST,
  FORBIDDEN,
  NOT_FOUND,
  SERVICE_UNAVAILABLE,
  UNAUTHORIZED,
} from "every-plugin/errors";
import { z } from "zod";

const CONFLICT = {
  status: 409,
  message: "The request conflicts with the current state",
} as const;

export const CreditClaimSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "issued", "expired", "failed", "revoked"]),
  keyPrefix: z.string().nullable(),
  spendLimitUsd: z.number().positive(),
  keyExpiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const AdminCreditClaimSchema = CreditClaimSchema.extend({
  nearAccountId: z.string(),
  userId: z.string(),
  ip: z.string().nullable(),
  ipClaimCount: z.number().int().nonnegative(),
  error: z.string().nullable(),
  revokedAt: z.iso.datetime().nullable(),
});

export const CreditSettingsSchema = z.object({
  enabled: z.boolean(),
  amountUsd: z.number(),
  claimsCloseAt: z.iso.datetime().nullable(),
  keyExpiresAt: z.iso.datetime().nullable(),
  nearAiWorkspaceId: z.string(),
  nearAiLoginAccountId: z.string(),
  updatedBy: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export const CreditSettingsInputSchema = z.object({
  enabled: z.boolean().default(false),
  amountUsd: z.number().positive(),
  claimsCloseAt: z.iso.datetime().nullable(),
  keyExpiresAt: z.iso.datetime().nullable(),
  nearAiWorkspaceId: z.string().max(256),
  nearAiLoginAccountId: z.string().max(256),
});

export const NearAiSignedMessageSchema = z.object({
  accountId: z.string().min(1).max(64),
  publicKey: z.string().min(1).max(2000),
  signature: z.string().min(1).max(2000),
  state: z.string().max(256).optional(),
});

export const NearAiLoginPayloadSchema = z.object({
  message: z.literal("Sign in to NEAR AI Cloud"),
  nonce: z.number().int().min(0).max(255).array().length(32),
  recipient: z.literal("cloud.near.ai"),
  callbackUrl: z.string().url().max(512).optional(),
});

export const NearAiSessionSchema = z.object({
  status: z.enum(["valid", "expired", "absent"]),
  refreshExpiresAt: z.iso.datetime().nullable(),
});

export const CreditEligibilitySchema = z.enum([
  "eligible",
  "needs_near_account",
  "needs_approved_profile",
]);

export const contract = oc.router({
  getCreditStatus: oc
    .route({ method: "GET", path: "/v1/credits/status" })
    .input(z.object({}))
    .output(
      z.object({
        available: z.boolean(),
        amountUsd: z.number().min(0),
        claimsCloseAt: z.iso.datetime().nullable(),
        eligibility: CreditEligibilitySchema,
        claim: CreditClaimSchema.nullable(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  claimCredits: oc
    .route({ method: "POST", path: "/v1/credits/claim" })
    .input(z.object({}))
    .output(z.object({ key: z.string(), claim: CreditClaimSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, CONFLICT, SERVICE_UNAVAILABLE }),

  listCreditClaims: oc
    .route({ method: "GET", path: "/v1/credits/claims" })
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().regex(/^\d+$/).optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(AdminCreditClaimSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  revokeCreditClaim: oc
    .route({ method: "POST", path: "/v1/credits/claims/{id}/revoke" })
    .input(z.object({ id: z.string().min(1).max(64) }))
    .output(z.object({ data: AdminCreditClaimSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, SERVICE_UNAVAILABLE }),

  getCreditSettings: oc
    .route({ method: "GET", path: "/v1/credits/settings" })
    .input(z.object({}))
    .output(z.object({ settings: CreditSettingsSchema.nullable() }))
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  updateCreditSettings: oc
    .route({ method: "POST", path: "/v1/credits/settings" })
    .input(CreditSettingsInputSchema)
    .output(z.object({ settings: CreditSettingsSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  nearAiSessionStatus: oc
    .route({ method: "GET", path: "/v1/credits/near-ai-session" })
    .input(z.object({}))
    .output(NearAiSessionSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, SERVICE_UNAVAILABLE }),

  loginNearAi: oc
    .route({ method: "POST", path: "/v1/credits/near-ai-session/login" })
    .input(
      z.object({
        signedMessage: NearAiSignedMessageSchema,
        payload: NearAiLoginPayloadSchema,
      }),
    )
    .output(NearAiSessionSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, SERVICE_UNAVAILABLE }),
});

export type ContractType = typeof contract;
