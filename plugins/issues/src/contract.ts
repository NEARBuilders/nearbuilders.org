import {
  BAD_REQUEST,
  CONNECTION_ERROR,
  FORBIDDEN,
  NOT_FOUND,
  RATE_LIMITED,
  SERVICE_UNAVAILABLE,
  TIMEOUT,
  UNAUTHORIZED,
} from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const RepoSlugPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-_.]{0,99})$/;
const RepoOwnerSchema = z.string().regex(RepoSlugPattern);
const RepoNameSchema = z.string().regex(RepoSlugPattern);
const IssueNumberSchema = z.number().int().positive();
const CursorSchema = z.string().regex(/^\d+$/);
const NearAccountSchema = z.string().trim().min(1).max(100);
const ClaimIdSchema = z.string().min(1).max(255);

export const IssueDifficultySchema = z.enum(["beginner", "intermediate", "advanced", "unknown"]);

export const IssueLabelSchema = z.object({
  name: z.string(),
  color: z.string().nullable(),
  description: z.string().nullable(),
});

export const IssueUserSchema = z.object({
  login: z.string(),
  avatarUrl: z.string().url().nullable(),
  htmlUrl: z.string().url().nullable(),
});

export const RepoIssueSchema = z.object({
  repoOwner: RepoOwnerSchema,
  repoName: RepoNameSchema,
  number: IssueNumberSchema,
  title: z.string(),
  body: z.string().nullable(),
  htmlUrl: z.string().url(),
  state: z.enum(["open", "closed"]),
  labels: z.array(IssueLabelSchema),
  difficulty: IssueDifficultySchema,
  author: IssueUserSchema.nullable(),
  commentCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  claim: z
    .object({
      id: ClaimIdSchema,
      nearAccount: NearAccountSchema,
      claimedAt: z.iso.datetime(),
      expiresAt: z.iso.datetime(),
      prUrl: z.string().url().nullable(),
      status: z.enum(["active", "submitted", "merged"]),
    })
    .nullable(),
});

export const IssueClaimSchema = z.object({
  id: ClaimIdSchema,
  repoOwner: RepoOwnerSchema,
  repoName: RepoNameSchema,
  issueNumber: IssueNumberSchema,
  issueTitle: z.string(),
  issueUrl: z.string().url(),
  nearAccount: NearAccountSchema,
  claimedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  releasedAt: z.iso.datetime().nullable(),
  prUrl: z.string().url().nullable(),
  status: z.enum(["active", "submitted", "merged", "released", "expired"]),
});

const IssuesUpstreamErrors = {
  CONNECTION_ERROR,
  RATE_LIMITED,
  SERVICE_UNAVAILABLE,
  TIMEOUT,
};

export const contract = oc.router({
  listRepoIssues: oc
    .route({ method: "GET", path: "/v1/issues" })
    .input(
      z.object({
        repoOwner: RepoOwnerSchema.optional(),
        repoName: RepoNameSchema.optional(),
        difficulty: IssueDifficultySchema.optional(),
        label: z.string().trim().min(1).max(60).optional(),
        claimed: z.enum(["any", "open", "claimed"]).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: CursorSchema.optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(RepoIssueSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
          repos: z.array(
            z.object({
              owner: RepoOwnerSchema,
              name: RepoNameSchema,
              htmlUrl: z.string().url(),
            }),
          ),
          labels: z.array(z.string()),
        }),
      }),
    )
    .errors({ BAD_REQUEST, ...IssuesUpstreamErrors }),

  getRepoIssue: oc
    .route({ method: "GET", path: "/v1/issues/{repoOwner}/{repoName}/{number}" })
    .input(
      z.object({
        repoOwner: RepoOwnerSchema,
        repoName: RepoNameSchema,
        number: IssueNumberSchema,
      }),
    )
    .output(z.object({ data: RepoIssueSchema }))
    .errors({ BAD_REQUEST, NOT_FOUND, ...IssuesUpstreamErrors }),

  listIssueClaims: oc
    .route({ method: "GET", path: "/v1/issues/claims" })
    .input(
      z.object({
        nearAccount: NearAccountSchema.optional(),
        active: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: CursorSchema.optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(IssueClaimSchema),
        meta: z.object({
          total: z.number().int().nonnegative(),
          hasMore: z.boolean(),
          nextCursor: z.string().nullable(),
        }),
      }),
    )
    .errors({ BAD_REQUEST }),

  claimIssue: oc
    .route({ method: "POST", path: "/v1/issues/claims" })
    .input(
      z.object({
        repoOwner: RepoOwnerSchema,
        repoName: RepoNameSchema,
        issueNumber: IssueNumberSchema,
        nearAccount: NearAccountSchema.optional(),
      }),
    )
    .output(z.object({ data: IssueClaimSchema }))
    .errors({
      UNAUTHORIZED,
      FORBIDDEN,
      BAD_REQUEST,
      NOT_FOUND,
      ...IssuesUpstreamErrors,
    }),

  releaseIssueClaim: oc
    .route({ method: "DELETE", path: "/v1/issues/claims/{id}" })
    .input(z.object({ id: ClaimIdSchema }))
    .output(z.object({ data: IssueClaimSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  attachPrToClaim: oc
    .route({ method: "PATCH", path: "/v1/issues/claims/{id}/pr" })
    .input(
      z.object({
        id: ClaimIdSchema,
        prUrl: z.string().url().max(500),
      }),
    )
    .output(z.object({ data: IssueClaimSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND }),
});

export type ContractType = typeof contract;
