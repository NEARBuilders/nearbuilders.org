import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { MemoryPublisher, ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { ContextSchema } from "./lib/context";

type McpEvents = Record<string, never>;

// Tool definitions with REST proxy config.
// method/path match the oRPC contract routes in each plugin.
const MCP_TOOLS = [
  {
    name: "list_projects",
    description: "List NEAR builder projects. Filter by kind, visibility, status, or owner.",
    rest: { method: "GET", path: "/v1/projects" },
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["project", "idea", "scope", "result"], description: "Project kind" },
        visibility: { type: "string", enum: ["private", "unlisted", "public"] },
        status: { type: "string", enum: ["active", "paused", "archived"] },
        ownerId: { type: "string", description: "Filter by owner user ID" },
        limit: { type: "number", minimum: 1, maximum: 100, description: "Page size (default 20)" },
        cursor: { type: "string", description: "Pagination cursor" },
      },
    },
  },
  {
    name: "get_project",
    description: "Get a single project by ID or slug.",
    rest: { method: "GET", path: "/v1/projects/{id}" },
    altSlugPath: "/v1/projects/by-slug/{slug}",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Project ID" },
        slug: { type: "string", description: "Project slug (alternative to ID)" },
      },
    },
  },
  {
    name: "create_project",
    description: "Create a new project. Requires authentication.",
    rest: { method: "POST", path: "/v1/projects" },
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["project", "idea", "scope", "result"] },
        title: { type: "string", description: "Project title (1-200 chars)" },
        slug: { type: "string", description: "URL slug (1-100 chars, a-z0-9-)" },
        description: { type: "string", description: "Short description (max 1000 chars)" },
        content: { type: "string", description: "Full content (max 50000 chars)" },
        visibility: { type: "string", enum: ["private", "unlisted", "public"] },
        repository: { type: "string", description: "GitHub repo URL" },
      },
      required: ["kind", "title", "slug"],
    },
  },
  {
    name: "update_project",
    description: "Update an existing project. Requires authentication.",
    rest: { method: "PATCH", path: "/v1/projects/{id}" },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Project ID" },
        title: { type: "string" },
        description: { type: "string" },
        content: { type: "string" },
        status: { type: "string", enum: ["active", "paused", "archived"] },
        visibility: { type: "string", enum: ["private", "unlisted", "public"] },
        repository: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_project",
    description: "Delete a project. Requires authentication.",
    rest: { method: "DELETE", path: "/v1/projects/{id}" },
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "list_builders",
    description: "List NEAR builders. Search by name or filter by skill.",
    rest: { method: "GET", path: "/v1/builders" },
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Search by name" },
        skill: { type: "string", description: "Filter by skill" },
        limit: { type: "number", minimum: 1, maximum: 100 },
        cursor: { type: "string" },
      },
    },
  },
  {
    name: "get_builder",
    description: "Get a builder profile by NEAR account.",
    rest: { method: "GET", path: "/v1/builders/{nearAccount}" },
    inputSchema: {
      type: "object",
      properties: { nearAccount: { type: "string" } },
      required: ["nearAccount"],
    },
  },
  {
    name: "create_builder",
    description: "Create a builder profile. Requires authentication.",
    rest: { method: "POST", path: "/v1/builders" },
    inputSchema: {
      type: "object",
      properties: {
        nearAccount: { type: "string" },
        name: { type: "string" },
        bio: { type: "string" },
        skills: { type: "array", items: { type: "string" } },
        location: { type: "string" },
      },
      required: ["nearAccount"],
    },
  },
  {
    name: "list_events",
    description: "List NEAR community events. Filter by status or visibility.",
    rest: { method: "GET", path: "/v1/events" },
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "cancelled"] },
        visibility: { type: "string", enum: ["private", "unlisted", "public"] },
        limit: { type: "number", minimum: 1, maximum: 100 },
        cursor: { type: "string" },
      },
    },
  },
  {
    name: "get_event",
    description: "Get a single event by ID or slug.",
    rest: { method: "GET", path: "/v1/events/{id}" },
    altSlugPath: "/v1/events/by-slug/{slug}",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        slug: { type: "string" },
      },
    },
  },
  {
    name: "create_event",
    description: "Create a new community event. Requires authentication.",
    rest: { method: "POST", path: "/v1/events" },
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        slug: { type: "string", description: "URL slug (1-100 chars, a-z0-9-)" },
        description: { type: "string" },
        content: { type: "string" },
        visibility: { type: "string", enum: ["private", "unlisted", "public"] },
        startAt: { type: "string", description: "ISO datetime" },
        endAt: { type: "string", description: "ISO datetime" },
        location: { type: "string" },
        lumaUrl: { type: "string", description: "Luma event URL" },
      },
      required: ["title", "slug", "startAt"],
    },
  },
  {
    name: "join_event",
    description: "Join an event as a participant. Requires authentication.",
    rest: { method: "POST", path: "/v1/events/{eventId}/participants" },
    inputSchema: {
      type: "object",
      properties: { eventId: { type: "string" } },
      required: ["eventId"],
    },
  },
  {
    name: "list_proposals",
    description: "List proposals. Filter by plugin, entity, or review status.",
    rest: { method: "GET", path: "/v1/proposals" },
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string" },
        entityId: { type: "string" },
        reviewStatus: { type: "string", enum: ["pending", "approved", "rejected", "removed"] },
        limit: { type: "number", minimum: 1, maximum: 100 },
        cursor: { type: "string" },
      },
    },
  },
  {
    name: "propose",
    description: "Submit a proposal for review. Requires authentication.",
    rest: { method: "POST", path: "/v1/proposals" },
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", description: "Target plugin ID" },
        entityId: { type: "string", description: "Target entity ID" },
        payload: { type: "object", description: "The proposal payload (varies by plugin)" },
        source: { type: "string", description: "Source of the proposal" },
      },
      required: ["pluginId", "entityId", "payload"],
    },
  },
  {
    name: "get_notifications",
    description: "Get notifications for the authenticated user.",
    rest: { method: "GET", path: "/v1/notifications/me" },
    inputSchema: {
      type: "object",
      properties: {
        read: { type: "boolean" },
        limit: { type: "number", minimum: 1, maximum: 100 },
        cursor: { type: "string" },
      },
    },
  },
  {
    name: "mark_notification_read",
    description: "Mark a notification as read. Requires authentication.",
    rest: { method: "POST", path: "/v1/notifications/{id}/read" },
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "mark_all_notifications_read",
    description: "Mark all notifications as read. Requires authentication.",
    rest: { method: "POST", path: "/v1/notifications/me/read-all" },
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_activity",
    description: "Get recent activity feed.",
    rest: { method: "GET", path: "/v1/activity" },
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 100 },
        cursor: { type: "string" },
      },
    },
  },
] as const;

type McpTool = (typeof MCP_TOOLS)[number];

// Resolve path params and query string from a REST template + args
function resolveRequest(tool: McpTool, args: Record<string, unknown>) {
  let path = tool.rest.path;

  // If slug is provided and there's an alt slug path, use it
  if (tool.altSlugPath && args.slug && !args.id) {
    path = tool.altSlugPath;
    delete args.id;
  } else if (tool.altSlugPath) {
    delete args.slug;
  }

  // Extract path params (e.g. {id}, {nearAccount})
  const pathParams: string[] = [];
  const resolvedPath = path.replace(/\{(\w+)\}/g, (_, key) => {
    pathParams.push(key);
    return encodeURIComponent(String(args[key] || ""));
  });

  // Remaining args become query params for GET, body for POST/PATCH/DELETE
  const remaining: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (!pathParams.includes(k)) remaining[k] = v;
  }

  return { resolvedPath, remaining, method: tool.rest.method };
}

async function proxyRequest(
  baseUrl: string,
  method: string,
  path: string,
  data: Record<string, unknown>,
  apiKey?: string,
) {
  const url = new URL("/api" + path, baseUrl);

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;

  if (method === "GET") {
    // oRPC GET routes accept input as JSON-encoded ?input=<...> query param
    const inputJson = JSON.stringify(data);
    url.searchParams.set("input", inputJson);
    const res = await fetch(url.toString(), { method, headers });
    return await res.json();
  }

  headers["Content-Type"] = "application/json";
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: JSON.stringify(data),
  });
  return await res.json();
}

export default createPlugin({
  variables: z.object({
    MCP_PLUGIN_REGISTRY_URL: z.string().default("http://localhost:3000"),
  }),

  secrets: z.object({}),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const publisher = new MemoryPublisher<McpEvents>({ resumeRetentionSeconds: 120 });
      const registryUrl = config.variables.MCP_PLUGIN_REGISTRY_URL;
      console.log("[MCP] Plugin Initialized, registry:", registryUrl);
      return { publisher, registryUrl };
    }),

  shutdown: () => Effect.log("[MCP] Shutdown"),

  createRouter: (services, builder) => {
    return {
      mcpTools: builder.mcpTools.handler(() => {
        return {
          data: MCP_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        };
      }),

      mcpCallTool: builder.mcpCallTool.handler(async ({ input, context }) => {
        // Require API key only for mutations (POST/PATCH/DELETE)
        const tool = MCP_TOOLS.find((t) => t.name === input.name);
        if (tool && tool.rest.method !== "GET" && !context.apiKey) {
          throw new ORPCError("UNAUTHORIZED", {
            message: "API key required for mutations",
            data: { authType: "apiKey", hint: "Provide a valid API key via x-api-key header" },
          });
        }

        if (!tool) {
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${input.name}. Available: ${MCP_TOOLS.map((t) => t.name).join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        const args = { ...(input.arguments || {}) };
        const { resolvedPath, remaining, method } = resolveRequest(tool, args);
        const baseUrl = services.registryUrl || "http://localhost:3000";
        const apiKey = (context.apiKey as any)?.key;

        try {
          const result = await proxyRequest(baseUrl, method, resolvedPath, remaining, apiKey);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to call ${tool.name}: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      }),
    };
  },
});
