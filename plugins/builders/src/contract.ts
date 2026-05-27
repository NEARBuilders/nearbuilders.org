import { BAD_REQUEST, FORBIDDEN, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const BuilderStatus = z.enum(["pending", "approved", "rejected"]);

const BuilderOutput = z.object({
  id: z.string(),
  nearAccount: z.string(),
  userId: z.string().nullable(),
  name: z.string().nullable(),
  bio: z.string().nullable(),
  skills: z.array(z.string()),
  location: z.string().nullable(),
  links: z.record(z.string(), z.string()).nullable(),
  status: BuilderStatus,
  rejectionReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const contract = oc.router({
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

  listPendingBuilders: oc
    .route({ method: "GET", path: "/v1/builders/pending" })
    .input(
      z.object({
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
    .errors({ UNAUTHORIZED, FORBIDDEN }),

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

  registerBuilder: oc
    .route({ method: "POST", path: "/v1/builders" })
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        bio: z.string().max(1000).optional(),
        skills: z.array(z.string().max(50)).max(20).optional(),
        location: z.string().max(100).optional(),
        links: z.record(z.string(), z.string()).optional(),
      }),
    )
    .output(z.object({ data: BuilderOutput }))
    .errors({ UNAUTHORIZED, BAD_REQUEST }),

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

  approveBuilder: oc
    .route({ method: "POST", path: "/v1/builders/{nearAccount}/approve" })
    .input(z.object({ nearAccount: z.string() }))
    .output(z.object({ data: BuilderOutput }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),

  rejectBuilder: oc
    .route({ method: "POST", path: "/v1/builders/{nearAccount}/reject" })
    .input(
      z.object({
        nearAccount: z.string(),
        reason: z.string().max(500).optional(),
      }),
    )
    .output(z.object({ data: BuilderOutput }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND }),
});

export type ContractType = typeof contract;
