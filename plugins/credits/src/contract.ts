import "@orpc/openapi/extensions/route";
import { oc } from "@orpc/contract";
import { FORBIDDEN, NOT_FOUND, SERVICE_UNAVAILABLE, UNAUTHORIZED } from "every-plugin/errors";
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

export const contract = oc.router({
  getCreditStatus: oc
    .route({ method: "GET", path: "/v1/credits/status" })
    .input(z.object({}))
    .output(
      z.object({
        available: z.boolean(),
        amountUsd: z.number().positive(),
        claimsCloseAt: z.iso.datetime().nullable(),
        eligibility: z.enum(["eligible", "needs_near_account", "needs_approved_profile"]),
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
});

export type ContractType = typeof contract;
