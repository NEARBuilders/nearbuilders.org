import { describe, expect, it } from "vitest";
import {
  AGENT_API_KEY_CONFIG_ID,
  AGENT_API_KEY_PURPOSE,
  AGENT_CATALOG_LINK_KEYS,
  agentApiKeyName,
  buildAgentProjectPrompt,
  mcpUrlFromOrigin,
} from "./agent-project-prompt";
import { CATALOG_PHASES } from "./project-catalog";

const KEY = "api_testKey123";
const MCP = "https://nearbuilders.org/api/mcp";

describe("mcpUrlFromOrigin", () => {
  it("appends /api/mcp to the origin", () => {
    expect(mcpUrlFromOrigin("http://localhost:3000")).toBe("http://localhost:3000/api/mcp");
    expect(mcpUrlFromOrigin("https://nearbuilders.org/")).toBe(MCP);
  });
});

describe("agentApiKeyName", () => {
  it("labels the key with its purpose, kind and date", () => {
    expect(agentApiKeyName("project", new Date("2026-10-31T12:00:00Z"))).toBe(
      "Agent: new project (2026-10-31)",
    );
  });

  it("uses the settings-page key config and a purpose label", () => {
    expect(AGENT_API_KEY_CONFIG_ID).toBe("user-keys");
    expect(AGENT_API_KEY_PURPOSE).toBe("agent-project-creation");
  });
});

describe("buildAgentProjectPrompt", () => {
  it("includes the MCP URL, the key header and the createProject tool", () => {
    const prompt = buildAgentProjectPrompt({ mcpUrl: MCP, apiKey: KEY, kind: "project" });
    expect(prompt).toContain(MCP);
    expect(prompt).toContain(`x-api-key: ${KEY}`);
    expect(prompt).toContain("`createProject`");
    expect(prompt).toContain('kind: "project"');
    expect(prompt).toContain("`updateProject`");
  });

  it("lists project requirements and every near-catalog field", () => {
    const prompt = buildAgentProjectPrompt({ mcpUrl: MCP, apiKey: KEY, kind: "project" });
    for (const field of ["`repository`", "`domain`", "`logoUrl`"]) {
      expect(prompt).toContain(field);
    }
    for (const field of [
      "`catalog`",
      "`tagline`",
      "`categories`",
      "`phase`",
      "`links`",
      "`tokenContract`",
      "`coingeckoId`",
    ]) {
      expect(prompt).toContain(field);
    }
    for (const { value } of CATALOG_PHASES) expect(prompt).toContain(`"${value}"`);
    for (const key of AGENT_CATALOG_LINK_KEYS) expect(prompt).toContain(`\`${key}\``);
  });

  it("asks for markdown content and skips catalog fields for non-project kinds", () => {
    const prompt = buildAgentProjectPrompt({ mcpUrl: MCP, apiKey: KEY, kind: "idea" });
    expect(prompt).toContain('kind: "idea"');
    expect(prompt).toContain("`content` (markdown body)");
    expect(prompt).not.toContain("`catalog`");
  });

  it("mentions the owner when known", () => {
    const prompt = buildAgentProjectPrompt({
      mcpUrl: MCP,
      apiKey: KEY,
      kind: "project",
      ownerId: "alice.near",
    });
    expect(prompt).toContain("`alice.near`");
  });
});
