import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const INVALID_NOMINATION = {
  status: 404,
  message: "Nomination link is invalid",
} as const;

const NOMINATION_CONFLICT = {
  status: 409,
  message: "Nomination was submitted by another builder",
} as const;

const IDEMPOTENCY_CONFLICT = {
  status: 409,
  message: "Idempotency key conflicts with an existing nomination",
} as const;

const BuilderOutput = z.object({
  id: z.string(),
  nearAccount: z.string(),
  userId: z.string().nullable(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  skills: z.array(z.string()),
  location: z.string().nullable(),
  links: z.record(z.string(), z.string()).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const TelegramNominationInput = z.object({
  source: z.literal("telegram"),
  sourceNominationId: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/)
    .max(128),
  nomineeTelegramId: z.number().int().positive().safe(),
  nomineeUsername: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(/^[A-Za-z0-9_]+$/)
    .nullable(),
  nominatedByTelegramId: z.number().int().positive().safe(),
  telegramGroupId: z.number().int().negative().safe(),
});

const TelegramNominationMetadata = z.object({
  nominationId: z.string(),
  source: z.literal("telegram"),
});

const TelegramNominationResolution = z.discriminatedUnion("status", [
  TelegramNominationMetadata.extend({ status: z.literal("ready") }),
  TelegramNominationMetadata.extend({ status: z.literal("submitted") }),
  z.object({ status: z.literal("invalid") }),
]);

const TelegramNominationResponse = z.object({
  nominationId: z.string(),
  joinUrl: z.string().url().startsWith("https://"),
});

const TelegramNominationHeaders = z.record(z.string(), z.string());

export const contract = oc.router({
  createTelegramNomination: oc
    .route({
      method: "POST",
      path: "/builders/nominations",
      inputStructure: "detailed",
      outputStructure: "detailed",
      successStatus: 201,
    })
    .input(
      z.object({
        headers: z.object({
          "idempotency-key": z.string().trim().min(1).max(255),
        }),
        body: TelegramNominationInput,
      }),
    )
    .output(
      z.union([
        z.object({
          status: z.literal(200),
          headers: TelegramNominationHeaders,
          body: TelegramNominationResponse,
        }),
        z.object({
          status: z.literal(201),
          headers: TelegramNominationHeaders,
          body: TelegramNominationResponse,
        }),
      ]),
    )
    .errors({ UNAUTHORIZED, BAD_REQUEST, IDEMPOTENCY_CONFLICT }),

  resolveTelegramNomination: oc
    .route({ method: "POST", path: "/builders/nominations/resolve" })
    .input(z.object({ token: z.string().min(1).max(256) }))
    .output(TelegramNominationResolution),

  finalizeTelegramNomination: oc
    .route({ method: "POST", path: "/builders/nominations/finalize" })
    .input(z.object({ token: z.string().min(1).max(256), proposalId: z.string().min(1) }))
    .output(TelegramNominationMetadata)
    .errors({
      UNAUTHORIZED,
      FORBIDDEN,
      INVALID_NOMINATION,
      NOMINATION_CONFLICT,
    }),

  listBuilders: oc
    .route({ method: "GET", path: "/v1/builders" })
    .input(
      z.object({
        search: z.string().optional(),
        skill: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(BuilderOutput),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST }),

  getBuilder: oc
    .route({ method: "GET", path: "/v1/builders/{nearAccount}" })
    .input(z.object({ nearAccount: z.string() }))
    .output(z.object({ data: BuilderOutput }))
    .errors({ NOT_FOUND }),

  getMyBuilderProfile: oc
    .route({ method: "GET", path: "/v1/builders/me" })
    .input(z.object({}))
    .output(z.object({ data: BuilderOutput.nullable() }))
    .errors({ UNAUTHORIZED }),

  createBuilder: oc
    .route({ method: "POST", path: "/v1/builders" })
    .input(
      z.object({
        nearAccount: z.string(),
        userId: z.string().optional(),
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(1000).optional(),
        skills: z.array(z.string().max(50)).max(20).optional(),
        location: z.string().max(100).optional(),
        links: z.record(z.string(), z.string()).optional(),
      }),
    )
    .output(z.object({ data: BuilderOutput }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  updateBuilderProfile: oc
    .route({ method: "PATCH", path: "/v1/builders/{nearAccount}" })
    .input(
      z.object({
        nearAccount: z.string(),
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(1000).optional(),
        skills: z.array(z.string().max(50)).max(20).optional(),
        location: z.string().max(100).optional(),
        links: z.record(z.string(), z.string()).optional(),
      }),
    )
    .output(z.object({ data: BuilderOutput }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  deleteBuilder: oc
    .route({ method: "DELETE", path: "/v1/builders/{nearAccount}" })
    .input(z.object({ nearAccount: z.string() }))
    .output(z.object({ deleted: z.boolean() }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),
});

export type ContractType = typeof contract;
