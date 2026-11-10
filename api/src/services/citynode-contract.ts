import { oc } from "@orpc/contract";
import { z } from "zod";

export const CityNodeAppNodeSchema = z.object({
  id: z.string(),
  kind: z.string().nullable(),
  slug: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  tenantId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CityNodeAppNodeSummarySchema = z.object({
  node: CityNodeAppNodeSchema,
  childrenCount: z.number().int().nonnegative(),
  validatorCount: z.number().int().nonnegative(),
});

export const cityNodeAppContract = oc.router({
  listNodeSummaries: oc
    .route({ method: "GET", path: "/nodes/summaries" })
    .input(
      z.object({
        scope: z.enum(["roots", "all"]),
        kind: z.string().min(1).optional(),
      }),
    )
    .output(z.array(CityNodeAppNodeSummarySchema)),
});

export type CityNodeAppContract = typeof cityNodeAppContract;
