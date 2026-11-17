import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Bot, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type ApiClient, useApiClient } from "@/app";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { activityIntegrationGuideUrl, buildActivityAgentPrompt } from "@/lib/activity-agent-prompt";

function projectPageUrl(slug: string) {
  return new URL(
    `/projects/project/${encodeURIComponent(slug)}`,
    window.location.origin,
  ).toString();
}

async function copyPrompt(prompt: string) {
  try {
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt copied");
  } catch {
    toast.error("Failed to copy prompt");
  }
}

const EVENT_TYPE_NAME_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MAX_EVENT_POINTS = 100;

export type ActivityProject = Pick<
  Awaited<ReturnType<ApiClient["getProject"]>>["data"],
  "id" | "kind" | "status" | "visibility"
>;

interface EventRow {
  key: number;
  name: string;
  points: string;
}

export function useProjectActivity(projectId: string) {
  const apiClient = useApiClient();
  return useQuery({
    queryKey: ["project-activity", projectId],
    queryFn: () => apiClient.getProjectActivity({ projectId }),
    staleTime: 30_000,
  });
}

export function activityIneligibleReason(project: ActivityProject): string | null {
  if (project.kind !== "project") return "Activity is only for projects";
  if (project.status !== "active") return "Available once your project is active";
  if (project.visibility === "unlisted") return "Available once your project is public or private";
  return null;
}

export function useActivityEligibility(project: ActivityProject, enabled: boolean) {
  const apiClient = useApiClient();
  const structuralReason = activityIneligibleReason(project);
  const query = useQuery({
    queryKey: ["project-proposal", project.id],
    queryFn: () => apiClient.getProposals({ pluginId: "projects", entityId: project.id, limit: 1 }),
    enabled: enabled && !structuralReason,
  });
  if (structuralReason) return { ready: true, eligible: false, reason: structuralReason };
  if (query.isError) return { ready: true, eligible: true, reason: null };
  if (!query.isSuccess) return { ready: false, eligible: false, reason: null };
  const latest = query.data.data[0]?.reviewStatus;
  if (latest && latest !== "approved") {
    return { ready: true, eligible: false, reason: "Available once your project is approved" };
  }
  return { ready: true, eligible: true, reason: null };
}

export function ProjectActivityBadge({ projectId }: { projectId: string }) {
  const { data } = useProjectActivity(projectId);
  if (data?.status !== "tracked") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent-border bg-brand-accent-light px-2.5 py-1 text-xs font-semibold text-foreground">
      <Activity className="size-3.5 text-brand-accent" />
      Activity Tracked
    </span>
  );
}

export function ProjectActivityAction({
  project,
  isOwner,
}: {
  project: ActivityProject & { slug: string };
  isOwner: boolean;
}) {
  const eligibility = useActivityEligibility(project, isOwner);
  const { data } = useProjectActivity(project.id);
  const [open, setOpen] = useState(false);

  if (!isOwner || !data) return null;

  if (data.status === "connected" || data.status === "tracked") {
    const url = new URL("/activity", data.activityUrl);
    if (data.sourceId) url.searchParams.set("source", data.sourceId);
    return (
      <Button asChild size="sm" variant="outline">
        <a href={url.toString()} target="_blank" rel="noreferrer" aria-label="View activity">
          <Activity size={13} />
          <span className="hidden sm:inline">View activity</span>
        </a>
      </Button>
    );
  }

  if (data.status !== "none" || !eligibility.ready) return null;

  if (!eligibility.eligible) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-disabled="true"
            aria-label={`Register Activity. ${eligibility.reason}`}
            className="cursor-not-allowed opacity-50"
          >
            <Activity size={13} />
            <span className="hidden sm:inline">Register Activity</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{eligibility.reason}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label="Register Activity"
        onClick={() => setOpen(true)}
      >
        <Activity size={13} />
        <span className="hidden sm:inline">Register Activity</span>
      </Button>
      <RegisterActivityDialog
        projectId={project.id}
        projectSlug={project.slug}
        activityUrl={data.activityUrl}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function eventRowError(row: EventRow, rows: EventRow[]): string | null {
  const name = row.name.trim();
  if (!name) return null;
  if (!EVENT_TYPE_NAME_PATTERN.test(name)) {
    return "Use lowercase letters and numbers, separated by dots, dashes, or underscores.";
  }
  if (rows.filter((other) => other.name.trim() === name).length > 1) {
    return "Each event needs a different name.";
  }
  return null;
}

function pointsError(points: string): string | null {
  if (points.trim() === "") return "Add points.";
  const value = Number(points);
  if (!Number.isInteger(value) || value < 0 || value > MAX_EVENT_POINTS) {
    return `Use a whole number from 0 to ${MAX_EVENT_POINTS}.`;
  }
  return null;
}

export function RegisterActivityDialog({
  projectId,
  projectSlug,
  activityUrl,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectSlug: string;
  activityUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apiClient = useApiClient();
  const agentPrompt = useMemo(
    () =>
      open
        ? buildActivityAgentPrompt({
            activityUrl,
            projectId,
            projectSlug,
            projectUrl: projectPageUrl(projectSlug),
          })
        : "",
    [open, activityUrl, projectId, projectSlug],
  );
  const [rows, setRows] = useState<EventRow[]>([{ key: 0, name: "", points: "10" }]);
  const [nextKey, setNextKey] = useState(1);

  const register = useMutation({
    mutationFn: (eventTypes: Array<{ name: string; pointValue: number }>) =>
      apiClient.registerProjectActivity({ projectId, eventTypes }),
  });

  const complete = rows.every(
    (row) => row.name.trim() && !eventRowError(row, rows) && !pointsError(row.points),
  );

  const updateRow = (key: number, update: Partial<EventRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...update } : row)));

  const submit = async () => {
    const tab = window.open("about:blank", "_blank");
    try {
      const { url } = await register.mutateAsync(
        rows.map((row) => ({ name: row.name.trim(), pointValue: Number(row.points) })),
      );
      if (tab) tab.location.href = url;
      else window.location.href = url;
      onOpenChange(false);
    } catch (error) {
      tab?.close();
      toast.error(error instanceof Error ? error.message : "Could not start Activity registration");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register Activity</DialogTitle>
          <DialogDescription>
            Pick the events your app will report. Each one credits the user who did it on their NEAR
            account. You confirm everything on activity.nearbuilders.org.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual" className="min-w-0">
          <TabsList>
            <TabsTrigger value="manual" className="px-3 sm:px-5">
              Set it up here
            </TabsTrigger>
            <TabsTrigger value="agent" className="px-3 sm:px-5">
              <Bot />
              Use your agent
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="space-y-4 pt-2">
            <div className="space-y-3">
              <div className="flex gap-2 text-xs font-medium text-muted-foreground">
                <span className="flex-1">Event name</span>
                <span className="w-24">Points</span>
                <span className="w-8" />
              </div>
              {rows.map((row, index) => {
                const nameError = eventRowError(row, rows);
                const rowPointsError = row.points.trim() === "" ? null : pointsError(row.points);
                return (
                  <div key={row.key} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`activity-event-name-${row.key}`} className="sr-only">
                        Event name {index + 1}
                      </Label>
                      <Input
                        id={`activity-event-name-${row.key}`}
                        value={row.name}
                        onChange={(event) => updateRow(row.key, { name: event.target.value })}
                        placeholder="listing.published"
                        aria-invalid={Boolean(nameError)}
                        autoComplete="off"
                        className="flex-1"
                      />
                      <Label htmlFor={`activity-event-points-${row.key}`} className="sr-only">
                        Points for event {index + 1}
                      </Label>
                      <Input
                        id={`activity-event-points-${row.key}`}
                        type="number"
                        min={0}
                        max={MAX_EVENT_POINTS}
                        step={1}
                        value={row.points}
                        onChange={(event) => updateRow(row.key, { points: event.target.value })}
                        aria-invalid={Boolean(rowPointsError)}
                        className="w-24"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove event ${index + 1}`}
                        disabled={rows.length === 1}
                        onClick={() =>
                          setRows((current) => current.filter(({ key }) => key !== row.key))
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    {(nameError || rowPointsError) && (
                      <p className="text-xs text-destructive" role="alert">
                        {nameError ?? rowPointsError}
                      </p>
                    )}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRows((current) => [...current, { key: nextKey, name: "", points: "10" }]);
                  setNextKey((key) => key + 1);
                }}
              >
                <Plus size={14} />
                Add another
              </Button>
              <p className="text-xs text-muted-foreground">
                Points range from 0 to {MAX_EVENT_POINTS}. 0 shows the event in the feed without
                scoring it. You can change points later on Activity.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={submit} disabled={!complete || register.isPending}>
                {register.isPending ? "Opening…" : "Next"}
                <ExternalLink size={14} />
              </Button>
            </DialogFooter>
          </TabsContent>
          <TabsContent value="agent" className="min-w-0 space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Copy this prompt into your coding agent inside the project repo. It connects to
              Activity's MCP server, proposes event types from your code and gives you a link to
              approve with your NEAR wallet.
            </p>
            <pre
              data-testid="activity-agent-prompt"
              className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground"
            >
              {agentPrompt}
            </pre>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a
                href={activityIntegrationGuideUrl(activityUrl)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
              >
                Integration guide
                <ExternalLink size={12} className="text-muted-foreground" />
              </a>
              <Button type="button" onClick={() => void copyPrompt(agentPrompt)}>
                <Copy size={14} />
                Copy prompt
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
