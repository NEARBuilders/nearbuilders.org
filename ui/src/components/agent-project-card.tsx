import { useCallback } from "react";
import {
  AGENT_API_KEY_PURPOSE,
  agentApiKeyName,
  buildAgentProjectPrompt,
} from "@/lib/agent-project-prompt";
import type { ProjectKind } from "@/lib/draft-store";
import { AgentAssistCard } from "./agent-assist-card";

interface AgentProjectCardProps {
  kind: ProjectKind;
  ownerId?: string;
}

/**
 * Project-creation variant of the shared agent assist card (#318).
 * Prompt content is injected; the card chrome lives in AgentAssistCard.
 */
export function AgentProjectCard({ kind, ownerId }: AgentProjectCardProps) {
  const buildPrompt = useCallback(
    ({ mcpUrl, apiKey }: { mcpUrl: string; apiKey: string }) =>
      buildAgentProjectPrompt({ mcpUrl, apiKey, kind, ownerId }),
    [kind, ownerId],
  );

  return (
    <AgentAssistCard
      description={`Create an API key, copy the prompt, and run it with your coding agent inside your project repo. It fills in the ${kind} details${kind === "project" ? " and NEAR Catalog metadata" : ""} over MCP.`}
      keyName={agentApiKeyName(kind)}
      keyPurpose={AGENT_API_KEY_PURPOSE}
      keyMetadata={{ kind }}
      buildPrompt={buildPrompt}
    />
  );
}
