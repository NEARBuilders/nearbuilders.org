export function activityMcpUrl(activityUrl: string): string {
  return `${activityUrl.replace(/\/+$/, "")}/api/v1/mcp`;
}

export function activityIntegrationGuideUrl(activityUrl: string): string {
  return `${activityUrl.replace(/\/+$/, "")}/docs/integration-guide`;
}

export interface ActivityAgentPromptInput {
  activityUrl: string;
  projectId: string;
  projectSlug: string;
  projectUrl: string;
}

export function buildActivityAgentPrompt({
  activityUrl,
  projectId,
  projectSlug,
  projectUrl,
}: ActivityAgentPromptInput): string {
  const site = activityUrl.replace(/\/+$/, "");
  const mcpUrl = activityMcpUrl(site);
  return [
    `Integrate ${site} into this project so it reports what its users do, using the Activity MCP server.`,
    "",
    "## Project",
    `- nearbuilders.org project id: \`${projectId}\``,
    `- Slug: \`${projectSlug}\``,
    `- Page: ${projectUrl}`,
    "",
    "## Steps",
    `1. Connect the MCP server at ${mcpUrl} (Streamable HTTP, no credentials). In Claude Code: \`claude mcp add --transport http activity ${mcpUrl}\``,
    "2. Read the codebase and propose a few Event Types for meaningful user actions with a clear actor and moment, such as `task.completed` (lowercase, dot or dash separated, 0-100 points). The actor of every event is the user's NEAR account ID.",
    `3. Call \`start_activity_registration\` with \`project: { id: "${projectId}", slug: "${projectSlug}", url: "${projectUrl}" }\` and the Event Types. Show me the url and the matchCode; I will sign in with my NEAR wallet, check the code, and approve one transaction.`,
    "4. Call `check_activity_registration` every 5 seconds until it is ready. Store the returned secret as `ACTIVITY_API_KEY` and the sourceId as `ACTIVITY_SOURCE_ID` in the gitignored `.env`, and never print the key. Use the Event Types I approved, not your proposal.",
    "   If this project already has an Activity Source, skip steps 3 and 4 and set `ACTIVITY_API_KEY=<your Source API Key>`.",
    `5. Report each Event Type from server-side code with \`POST ${site}/api/v1/events\` and \`Authorization: Bearer <ACTIVITY_API_KEY>\`, with a stable idempotencyKey per event, as described in ${site}/skill.md.`,
    "6. Call `submit_activity_event` with the stored `ACTIVITY_API_KEY` as apiKey, eventType `activity.test`, and a real NEAR account as actor, then tell me the sourceId, the test eventId, and where in the code each approved Event Type is reported.",
  ].join("\n");
}
