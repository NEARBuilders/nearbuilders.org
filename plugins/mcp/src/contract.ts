import { BAD_REQUEST, NOT_FOUND, UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

const McpToolResult = z.object({
  content: z.array(
    z.union([
      z.object({ type: z.literal("text"), text: z.string() }),
      z.object({ type: z.literal("resource"), uri: z.string(), name: z.string().optional(), mimeType: z.string().optional() }),
    ]),
  ),
  isError: z.boolean().optional(),
});

export const contract = oc.router({
  mcpTools: oc
    .route({ method: "POST", path: "/v1/mcp/tools/list" })
    .input(z.object({}))
    .output(z.object({ data: z.array(z.object({ name: z.string(), description: z.string(), inputSchema: z.unknown() })) }))
    .errors({ UNAUTHORIZED }),

  mcpCallTool: oc
    .route({ method: "POST", path: "/v1/mcp/tools/call" })
    .input(z.object({ name: z.string(), arguments: z.record(z.string(), z.unknown()).optional() }))
    .output(McpToolResult)
    .errors({ BAD_REQUEST, NOT_FOUND }),
});

export type ContractType = typeof contract;
