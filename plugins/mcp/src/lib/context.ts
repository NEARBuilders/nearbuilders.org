import { z } from "every-plugin/zod";

export const ContextSchema = z.object({
  user: z
    .object({
      id: z.string(),
      role: z.string().optional(),
    })
    .optional(),
  userId: z.string().optional(),
  apiKey: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      prefix: z.string().nullable(),
      key: z.string(),
      permissions: z.record(z.unknown()).optional(),
    })
    .optional(),
});
