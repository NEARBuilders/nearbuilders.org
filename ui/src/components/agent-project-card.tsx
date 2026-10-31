import { useMutation } from "@tanstack/react-query";
import { Bot, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthClient } from "@/app";
import {
  AGENT_API_KEY_CONFIG_ID,
  AGENT_API_KEY_EXPIRES_IN,
  AGENT_API_KEY_PURPOSE,
  agentApiKeyName,
  buildAgentProjectPrompt,
  mcpUrlFromOrigin,
} from "@/lib/agent-project-prompt";
import type { ProjectKind } from "@/lib/draft-store";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";

interface AgentProjectCardProps {
  kind: ProjectKind;
  ownerId?: string;
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Failed to copy ${label.toLowerCase()}`);
  }
}

/**
 * "Let your agent do this": mints a short-lived API key under the current session and
 * hands the user a prompt that points their agent at the MCP surface. Replaceable once
 * a device/approval flow exists.
 */
export function AgentProjectCard({ kind, ownerId }: AgentProjectCardProps) {
  const auth = useAuthClient();
  const [apiKey, setApiKey] = useState<string | null>(null);

  const createKey = useMutation({
    mutationFn: async () => {
      const { data, error } = await auth.apiKey.create({
        configId: AGENT_API_KEY_CONFIG_ID,
        name: agentApiKeyName(kind),
        expiresIn: AGENT_API_KEY_EXPIRES_IN,
        metadata: { purpose: AGENT_API_KEY_PURPOSE, kind },
      });
      if (error) throw new Error(error.message);
      if (!data?.key) throw new Error("API key was not returned");
      return data.key;
    },
    onSuccess: (key) => {
      setApiKey(key);
      toast.success("API key created");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create API key"),
  });

  const copyPrompt = () => {
    if (!apiKey) return;
    const prompt = buildAgentProjectPrompt({
      mcpUrl: mcpUrlFromOrigin(window.location.origin),
      apiKey,
      kind,
      ownerId,
    });
    void copyText(prompt, "Prompt");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pb-28 pt-2 sm:px-6 sm:pb-8 lg:px-8">
      <Card data-testid="agent-project-card">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Bot className="h-4 w-4 text-foreground" />
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-foreground">Let your agent do this</div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Create an API key, copy the prompt, and run it with your coding agent inside your
                project repo. It fills in the {kind} details
                {kind === "project" ? " and NEAR Catalog metadata" : ""} over MCP.
              </p>
            </div>
          </div>

          {apiKey ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Shown once. The key expires in 7 days and can be deleted under Settings → API keys.
              </p>
              {/* oxlint-disable-next-line shadcn/no-arbitrary-values -- flexible-input/fixed-button grid split; grid-template-columns has no scale equivalent */}
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  readOnly
                  aria-label="API key"
                  value={apiKey}
                  className="font-mono text-xs"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(apiKey, "API key")}
                >
                  <Copy className="h-3.5 w-3.5" />
                  copy key
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={apiKey ? "outline" : "default"}
              onClick={() => createKey.mutate()}
              disabled={createKey.isPending || Boolean(apiKey)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {createKey.isPending
                ? "creating..."
                : apiKey
                  ? "API key created"
                  : "Create an API key"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={apiKey ? "default" : "outline"}
              onClick={copyPrompt}
              disabled={!apiKey}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy this prompt
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
