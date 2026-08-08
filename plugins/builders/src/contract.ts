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

const NOMINATION_NOT_FOUND = {
  status: 404,
  message: "Nomination not found",
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

const TelegramUsername = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9_]+$/);

const TelegramNominationInput = z
  .object({
    source: z.literal("telegram"),
    sourceNominationId: z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/)
      .max(128),
    nomineeTelegramId: z.number().int().positive().safe().nullable(),
    nomineeUsername: TelegramUsername.nullable(),
    nominatedByTelegramId: z.number().int().positive().safe(),
    telegramGroupId: z.number().int().negative().safe(),
  })
  .refine((input) => input.nomineeTelegramId !== null || input.nomineeUsername !== null, {
    message: "A Telegram ID or username is required",
    path: ["nomineeUsername"],
  });

const TelegramNominationClaimInput = z.object({
  nominationId: z.string().trim().min(1).max(64).optional(),
  nomineeTelegramId: z.number().int().positive().safe(),
  nomineeUsername: TelegramUsername.nullable(),
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
  status: z.enum(["awaiting_claim", "awaiting_profile", "submitted"]),
  joinUrl: z.string().url().startsWith("https://").optional(),
  proposalId: z.string().nullable(),
  proposalEntityId: z.string().nullable(),
});

const XId = z
  .string()
  .regex(/^[1-9]\d*$/)
  .max(32);
const XUsername = z
  .string()
  .min(1)
  .max(15)
  .regex(/^[A-Za-z0-9_]+$/);
const PublicUrl = z
  .string()
  .url()
  .refine((value) => /^https?:$/i.test(new URL(value).protocol), "HTTP or HTTPS URL required");
const XPostUrl = PublicUrl.refine((value) => {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "x.com" || hostname === "www.x.com";
}, "An x.com post URL is required");

const XNominationInput = z
  .object({
    source: z.literal("x"),
    sourceNominationId: XId,
    sourcePostUrl: XPostUrl,
    sourcePostText: z
      .string()
      .max(10_000)
      .refine((value) => value.trim().length > 0, "Source X post text is required"),
    sourcePostCreatedAt: z.iso.datetime().nullable(),
    nominatedByXId: XId,
    nominatedByXUsername: XUsername,
    nomineeXId: XId,
    nomineeXUsername: XUsername,
    conversationId: XId.nullable(),
    replyToPostId: XId.nullable(),
  })
  .refine((input) => input.nominatedByXId !== input.nomineeXId, {
    message: "X users cannot nominate themselves",
    path: ["nomineeXId"],
  })
  .refine(
    (input) => {
      const path = new URL(input.sourcePostUrl).pathname.split("/").filter(Boolean);
      const statusIndex = path.lastIndexOf("status");
      return statusIndex >= 0 && path[statusIndex + 1] === input.sourceNominationId;
    },
    {
      message: "The X post URL must match sourceNominationId",
      path: ["sourcePostUrl"],
    },
  );

const XNominationReceipt = z.object({
  nominationId: z.string(),
});

const XReferralContext = z.object({
  sourcePostId: z.string(),
  sourcePostUrl: z.string(),
  sourcePostText: z.string(),
  sourcePostCreatedAt: z.iso.datetime().nullable(),
  conversationId: z.string().nullable(),
  replyToPostId: z.string().nullable(),
  nominatorXId: z.string(),
  nominatorXUsername: z.string(),
  nomineeXId: z.string(),
  nomineeXUsername: z.string(),
});

const NominationResolution = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    nominationId: z.string(),
    referralNominationId: z.string(),
    source: z.enum(["telegram", "x"]),
    referralContext: XReferralContext.optional(),
  }),
  z.object({
    status: z.literal("submitted"),
    nominationId: z.string(),
    referralNominationId: z.string(),
    source: z.enum(["telegram", "x"]),
    referralContext: XReferralContext.optional(),
  }),
  z.object({ status: z.literal("invalid") }),
]);

const XEngagementStatus = z.enum(["pending_contact", "contacted", "rejected", "completed"]);

const XNominationQueueRecord = z.object({
  id: z.string(),
  canonicalNominationId: z.string(),
  isCanonical: z.boolean(),
  sourcePostId: z.string(),
  sourcePostUrl: z.string(),
  sourcePostText: z.string(),
  sourcePostCreatedAt: z.iso.datetime().nullable(),
  conversationId: z.string().nullable(),
  replyToPostId: z.string().nullable(),
  nominatorXId: z.string(),
  nominatorXUsername: z.string(),
  nomineeXId: z.string(),
  nomineeXUsername: z.string(),
  linkedNomineeBuilderId: z.string().nullable(),
  linkedNomineeNearAccount: z.string().nullable(),
  linkedNominatorBuilderId: z.string().nullable(),
  linkedNominatorNearAccount: z.string().nullable(),
  canonicalSourcePostId: z.string(),
  sourceReferralCount: z.number().int().positive(),
  joinUrl: z.string().url().startsWith("https://").nullable(),
  engagementStatus: XEngagementStatus,
  replyUrl: z.string().nullable(),
  contactedAt: z.iso.datetime().nullable(),
  rejectedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  engagementUpdatedAt: z.iso.datetime(),
  updatedBy: z.string().nullable(),
  firstOpenedAt: z.iso.datetime().nullable(),
  lastOpenedAt: z.iso.datetime().nullable(),
  openCount: z.number().int().nonnegative(),
  proposalId: z.string().nullable(),
  submittedNearAccount: z.string().nullable(),
  submittedAt: z.iso.datetime().nullable(),
  profileStatus: z.enum(["not_started", "submitted"]),
  createdAt: z.iso.datetime(),
});

const XNominationMetrics = z.object({
  totalNominations: z.number().int().nonnegative(),
  uniqueNominees: z.number().int().nonnegative(),
  pendingReviewCount: z.number().int().nonnegative(),
  humanReviewedContacts: z.number().int().nonnegative(),
  qualifiedEngagementReplies: z.number().int().nonnegative(),
  secureLinkOpens: z.number().int().nonnegative(),
  profilesSubmitted: z.number().int().nonnegative(),
  registrationConversionRate: z.number().min(0).max(1),
  byNominator: z.array(
    z.object({
      xId: z.string(),
      username: z.string(),
      nominations: z.number().int().nonnegative(),
      qualifiedReplies: z.number().int().nonnegative(),
      profilesSubmitted: z.number().int().nonnegative(),
    }),
  ),
  bySourcePost: z.array(
    z.object({
      postId: z.string(),
      postUrl: z.string(),
      opens: z.number().int().nonnegative(),
      profileSubmitted: z.boolean(),
    }),
  ),
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
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, IDEMPOTENCY_CONFLICT }),

  createXNomination: oc
    .route({
      method: "POST",
      path: "/builders/nominations/x",
      inputStructure: "detailed",
      outputStructure: "detailed",
      successStatus: 201,
    })
    .input(
      z.object({
        headers: z.object({
          "idempotency-key": z.string().trim().min(1).max(255),
        }),
        body: XNominationInput,
      }),
    )
    .output(
      z.union([
        z.object({
          status: z.literal(200),
          headers: TelegramNominationHeaders,
          body: XNominationReceipt,
        }),
        z.object({
          status: z.literal(201),
          headers: TelegramNominationHeaders,
          body: XNominationReceipt,
        }),
      ]),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, IDEMPOTENCY_CONFLICT }),

  claimTelegramNomination: oc
    .route({ method: "POST", path: "/builders/nominations/claim" })
    .input(TelegramNominationClaimInput)
    .output(TelegramNominationResponse)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOMINATION_NOT_FOUND }),

  resolveTelegramNomination: oc
    .route({ method: "POST", path: "/builders/nominations/resolve" })
    .input(z.object({ token: z.string().min(1).max(256) }))
    .output(TelegramNominationResolution),

  resolveNomination: oc
    .route({ method: "POST", path: "/builders/nominations/resolve-generic" })
    .input(
      z.object({
        token: z.string().min(1).max(256),
        recordOpen: z.boolean().optional(),
      }),
    )
    .output(NominationResolution),

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

  finalizeNomination: oc
    .route({ method: "POST", path: "/builders/nominations/finalize-generic" })
    .input(z.object({ token: z.string().min(1).max(256), proposalId: z.string().min(1) }))
    .output(
      z.object({
        nominationId: z.string(),
        referralNominationId: z.string(),
        source: z.enum(["telegram", "x"]),
      }),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN, INVALID_NOMINATION, NOMINATION_CONFLICT }),

  listXNominationQueue: oc
    .route({ method: "GET", path: "/builders/nominations/x/review" })
    .input(
      z.object({
        status: XEngagementStatus.optional(),
        search: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(XNominationQueueRecord),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ UNAUTHORIZED, FORBIDDEN }),

  updateXNomination: oc
    .route({ method: "PATCH", path: "/builders/nominations/x/{nominationId}" })
    .input(
      z.object({
        nominationId: z.string().min(1),
        expectedEngagementUpdatedAt: z.iso.datetime(),
        action: z.enum(["mark_contacted", "reject", "reopen"]),
        replyUrl: XPostUrl.optional(),
      }),
    )
    .output(XNominationQueueRecord)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST, NOMINATION_CONFLICT }),

  getXNominationMetrics: oc
    .route({ method: "GET", path: "/builders/nominations/x/metrics" })
    .input(z.object({}))
    .output(XNominationMetrics)
    .errors({ UNAUTHORIZED, FORBIDDEN }),

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
