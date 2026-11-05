import { useCallback } from "react";
import {
  AGENT_BUILDER_API_KEY_PURPOSE,
  agentBuilderApiKeyName,
  buildAgentBuilderPrompt,
} from "@/lib/agent-project-prompt";
import { AgentAssistCard } from "./agent-assist-card";

interface AgentBuilderCardProps {
  nearAccount?: string;
  nominationToken?: string | null;
  className?: string;
}

/**
 * /join builder-profile variant of the shared agent assist card (#320).
 * Same chrome as project creation; prompt content is injected.
 */
export function AgentBuilderCard({
  nearAccount,
  nominationToken,
  className,
}: AgentBuilderCardProps) {
  const token = nominationToken ?? undefined;
  const buildPrompt = useCallback(
    ({ mcpUrl, apiKey }: { mcpUrl: string; apiKey: string }) =>
      buildAgentBuilderPrompt({
        mcpUrl,
        apiKey,
        nearAccount,
        nominationToken: token,
      }),
    [nearAccount, token],
  );

  return (
    <AgentAssistCard
      className={className}
      description="Create an API key, copy the prompt, and run it with your coding agent. It fills in your builder profile (catalog fields, skills, links) over MCP."
      keyName={agentBuilderApiKeyName()}
      keyPurpose={AGENT_BUILDER_API_KEY_PURPOSE}
      keyMetadata={{ flow: "builder-join" }}
      buildPrompt={buildPrompt}
    />
  );
}
