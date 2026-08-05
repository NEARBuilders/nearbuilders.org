import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const FeedbackRequestStatusSchema = z.enum([
  "open",
  "filling",
  "testing",
  "complete",
  "closed",
]);
export type FeedbackRequestStatus = z.infer<typeof FeedbackRequestStatusSchema>;

export const ProjectKindSchema = z.enum(["project", "idea", "scope", "result"]);

const RepoSlug = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "Use owner/repo format");

export const ApplicationCountsSchema = z.object({
  pending: z.number().int().nonnegative(),
  selected: z.number().int().nonnegative(),
});
export type ApplicationCounts = z.infer<typeof ApplicationCountsSchema>;

export const FeedbackRequestSchema = z.object({
  id: z.string(),
  ownerNearAccount: z.string(),
  projectId: z.string(),
  projectSlug: z.string(),
  projectKind: ProjectKindSchema,
  projectTitle: z.string(),
  title: z.string(),
  body: z.string(),
  testersWanted: z.number().int().min(1).max(20),
  timeframeDays: z.number().int().min(1).max(30),
  targetRepo: RepoSlug,
  requirements: z.string().nullable(),
  status: FeedbackRequestStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
  applicationCounts: ApplicationCountsSchema,
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

export const FeedbackApplicationStatusSchema = z.enum([
  "pending",
  "selected",
  "rejected",
  "withdrawn",
]);
export type FeedbackApplicationStatus = z.infer<typeof FeedbackApplicationStatusSchema>;

export const FeedbackApplicationSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  applicantNearAccount: z.string(),
  note: z.string().nullable(),
  status: FeedbackApplicationStatusSchema,
  requestTitle: z.string(),
  requestProjectTitle: z.string(),
  requestTargetRepo: z.string(),
  appliedAt: z.string(),
  decidedAt: z.string().nullable(),
  decidedBy: z.string().nullable(),
});
export type FeedbackApplication = z.infer<typeof FeedbackApplicationSchema>;

const ListMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

export const contract = {
  listFeedbackRequests: oc
    .route({ method: "GET", path: "/v1/feedback/requests" })
    .input(
      z.object({
        status: FeedbackRequestStatusSchema.optional(),
        ownerNearAccount: z.string().optional(),
        projectId: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(FeedbackRequestSchema),
        meta: ListMetaSchema,
      }),
    )
    .errors({ BAD_REQUEST }),

  getFeedbackRequest: oc
    .route({ method: "GET", path: "/v1/feedback/requests/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: FeedbackRequestSchema }))
    .errors({ NOT_FOUND }),

  createFeedbackRequest: oc
    .route({ method: "POST", path: "/v1/feedback/requests" })
    .input(
      z.object({
        projectId: z.string().trim().min(1).max(200),
        projectSlug: z.string().trim().min(1).max(200),
        projectKind: ProjectKindSchema,
        projectTitle: z.string().trim().min(1).max(200),
        title: z.string().trim().min(4).max(140),
        body: z.string().trim().min(20).max(4000),
        testersWanted: z.number().int().min(1).max(20),
        timeframeDays: z.number().int().min(1).max(30).default(14),
        targetRepo: RepoSlug,
        requirements: z.string().trim().max(200).optional(),
      }),
    )
    .output(z.object({ data: FeedbackRequestSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST }),

  listFeedbackApplications: oc
    .route({ method: "GET", path: "/v1/feedback/applications" })
    .input(
      z.object({
        requestId: z.string().optional(),
        applicantNearAccount: z.string().optional(),
        status: FeedbackApplicationStatusSchema.optional(),
        limit: z.number().int().min(1).max(50).optional(),
        cursor: z.string().optional(),
      }),
    )
    .output(
      z.object({
        data: z.array(FeedbackApplicationSchema),
        meta: ListMetaSchema,
      }),
    )
    .errors({ BAD_REQUEST }),

  applyToFeedbackRequest: oc
    .route({ method: "POST", path: "/v1/feedback/requests/{requestId}/applications" })
    .input(
      z.object({
        requestId: z.string(),
        note: z.string().trim().max(600).optional(),
      }),
    )
    .output(z.object({ data: FeedbackApplicationSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  withdrawFeedbackApplication: oc
    .route({ method: "DELETE", path: "/v1/feedback/applications/{id}" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: FeedbackApplicationSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  selectFeedbackApplicant: oc
    .route({ method: "POST", path: "/v1/feedback/applications/{id}/select" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: FeedbackApplicationSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),

  rejectFeedbackApplicant: oc
    .route({ method: "POST", path: "/v1/feedback/applications/{id}/reject" })
    .input(z.object({ id: z.string() }))
    .output(z.object({ data: FeedbackApplicationSchema }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST }),
};

export type ContractType = typeof contract;
