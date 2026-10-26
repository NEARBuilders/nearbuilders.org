import { z } from "every-plugin/zod";

export const CITY_NODE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const cityNodeKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(CITY_NODE_KEY_PATTERN, { message: "City node must be a citynode.app community path" });

export const cityNodeFilterSchema = z.string().trim().toLowerCase().max(200).optional();
