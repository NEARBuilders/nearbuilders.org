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
});
export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

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
};

export type ContractType = typeof contract;
