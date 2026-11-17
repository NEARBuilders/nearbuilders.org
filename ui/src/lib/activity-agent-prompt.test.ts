import { describe, expect, it } from "vitest";
import {
  activityIntegrationGuideUrl,
  activityMcpUrl,
  buildActivityAgentPrompt,
} from "./activity-agent-prompt";

describe("activity agent prompt", () => {
  const prompt = buildActivityAgentPrompt({
    activityUrl: "https://activity.example/",
    projectId: "proj_123",
    projectSlug: "demo-app",
    projectUrl: "https://nearbuilders.example/projects/project/demo-app",
  });

  it("points the agent at activity's MCP endpoint", () => {
    expect(activityMcpUrl("https://activity.example/")).toBe("https://activity.example/api/v1/mcp");
    expect(prompt).toContain("MCP server at https://activity.example/api/v1/mcp");
  });

  it("names the project so registration binds to it", () => {
    expect(prompt).toContain("`proj_123`");
    expect(prompt).toContain(
      'project: { id: "proj_123", slug: "demo-app", url: "https://nearbuilders.example/projects/project/demo-app" }',
    );
  });

  it("keeps the API key as a placeholder", () => {
    expect(prompt).toContain("ACTIVITY_API_KEY=<your Source API Key>");
    expect(prompt).not.toMatch(/api_[A-Za-z0-9]{8,}/);
  });

  it("links the integration guide", () => {
    expect(activityIntegrationGuideUrl("https://activity.example")).toBe(
      "https://activity.example/docs/integration-guide",
    );
  });
});
