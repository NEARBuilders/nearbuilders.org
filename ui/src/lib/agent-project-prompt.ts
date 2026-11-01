import type { ProjectKind } from "./draft-store";
import { CATALOG_LINKS, CATALOG_PHASES, type CatalogLinkKey } from "./project-catalog";

/** Better Auth API-key config used by the settings page; keys created here show up there. */
export const AGENT_API_KEY_CONFIG_ID = "user-keys";
/** Purpose label stored in key metadata so agent keys are identifiable later. */
export const AGENT_API_KEY_PURPOSE = "agent-project-creation";
/** Agent keys are short-lived: 7 days. */
export const AGENT_API_KEY_EXPIRES_IN = 7 * 24 * 60 * 60;

/** Catalog link keys accepted by the projects contract; single source is CATALOG_LINKS. */
export const AGENT_CATALOG_LINK_KEYS: readonly CatalogLinkKey[] = CATALOG_LINKS.map(
  ({ key }) => key,
);

export function agentApiKeyName(kind: ProjectKind, now: Date = new Date()): string {
  return `Agent: new ${kind} (${now.toISOString().slice(0, 10)})`;
}

export function mcpUrlFromOrigin(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/api/mcp`;
}

export interface AgentProjectPromptInput {
  mcpUrl: string;
  apiKey: string;
  kind: ProjectKind;
  ownerId?: string;
}

export function buildAgentProjectPrompt({
  mcpUrl,
  apiKey,
  kind,
  ownerId,
}: AgentProjectPromptInput): string {
  const phases = CATALOG_PHASES.map((p) => `"${p.value}"`).join(", ");
  const required =
    kind === "project"
      ? "`title`, `repository` (full https URL to the repo) and `domain` (product hostname only, no scheme or path, e.g. `app.example.com`)"
      : "`title` and `content` (markdown body)";

  const lines = [
    `Create a NEAR Builders ${kind} for the project in this repository, using the NEAR Builders MCP server.`,
    "",
    "## Connect",
    `- MCP endpoint (Streamable HTTP): ${mcpUrl}`,
    `- Send this header on every request: \`x-api-key: ${apiKey}\``,
    "- Treat the key as a secret: do not commit it or write it to files in the repo.",
    ...(ownerId ? [`- The ${kind} will be owned by \`${ownerId}\`.`] : []),
    "",
    "## Steps",
    "1. Read this repo (README, package metadata, docs, website/social links, token contracts) to gather the project information below. Do not invent facts; leave a field out if you cannot find it.",
    `2. Call the \`createProject\` tool with \`kind: "${kind}"\` and \`visibility: "private"\` (I'll review and publish it from the site).`,
    "3. Reply with the created project's `slug` and a summary of the fields you set and the fields you could not find.",
    "",
    "## Project fields",
    `- Required: ${required}.`,
    "- `slug`: lowercase letters, numbers and dashes only (max 100), derived from the title. If it is already taken, add a short suffix and retry.",
    "- `description`: one or two sentences, max 1000 characters.",
    ...(kind === "project"
      ? [
          "- `content`: optional markdown overview (what it does, how it uses NEAR).",
          "- `logoUrl`: optional https URL to a square logo image.",
        ]
      : []),
  ];

  if (kind === "project") {
    lines.push(
      "",
      "## NEAR Catalog fields (`catalog` object)",
      "- `tagline`: short pitch, max 140 characters.",
      "- `categories`: up to 6 lowercase kebab-case slugs, e.g. `defi`, `nft`, `infrastructure`, `ai`.",
      `- \`phase\`: one of ${phases}.`,
      `- \`links\`: object of full URLs keyed by ${AGENT_CATALOG_LINK_KEYS.map((k) => `\`${k}\``).join(", ")}.`,
      "- `tokenContract`: the NEAR account id of the project's token contract (e.g. `token.example.near`), only if it has one.",
      "- `coingeckoId`: the CoinGecko id (lowercase, dashes), only if it is listed.",
    );
  }

  lines.push(
    "",
    "To fix something after creating it, call `updateProject` with the project `id` and only the fields that change.",
  );

  return lines.join("\n");
}
