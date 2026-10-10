import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
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

const EVENT_TYPE_NAME_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MAX_EVENT_POINTS = 100;

interface ActivityProject {
  id: string;
  kind: string;
  status: string;
  visibility: string;
}

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

function useProjectApproved(projectId: string, enabled: boolean) {
  const apiClient = useApiClient();
  const query = useQuery({
    queryKey: ["project-proposal", projectId],
    queryFn: () => apiClient.getProposals({ pluginId: "projects", entityId: projectId, limit: 1 }),
    enabled,
  });
  const latest = query.data?.data[0]?.reviewStatus;
  return query.isSuccess && (!latest || latest === "approved");
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

export function ProjectActivityRejected({
  projectId,
  visible,
}: {
  projectId: string;
  visible: boolean;
}) {
  const { data } = useProjectActivity(projectId);
  if (!visible || data?.status !== "rejected") return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div>
        <p className="font-semibold text-foreground">Activity connection rejected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.reviewReason ?? "An Activity administrator rejected this project's connection."}
        </p>
      </div>
    </div>
  );
}

export function ProjectActivityAction({
  project,
  isOwner,
}: {
  project: ActivityProject;
  isOwner: boolean;
}) {
  const eligible =
    project.kind === "project" && project.status === "active" && project.visibility !== "unlisted";
  const approved = useProjectApproved(project.id, isOwner && eligible);
  const { data } = useProjectActivity(project.id);
  const [open, setOpen] = useState(false);

  if (!isOwner || !data) return null;

  if (data.status === "connected" || data.status === "tracked") {
    const url = new URL("/activity", data.activityUrl);
    if (data.sourceId) url.searchParams.set("source", data.sourceId);
    return (
      <Button asChild size="sm" variant="outline">
        <a href={url.toString()} target="_blank" rel="noreferrer">
          <Activity size={13} />
          <span className="hidden sm:inline">View activity</span>
        </a>
      </Button>
    );
  }

  if (data.status !== "none" || !eligible || !approved) return null;

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Activity size={13} />
        <span className="hidden sm:inline">Register Activity</span>
      </Button>
      <RegisterActivityDialog projectId={project.id} open={open} onOpenChange={setOpen} />
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
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apiClient = useApiClient();
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
            Add the events your app will report. Each one credits the user who did it on their NEAR
            account. You confirm everything on activity.nearbuilders.org next.
          </DialogDescription>
        </DialogHeader>

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
            Points range from 0 to {MAX_EVENT_POINTS}. 0 shows the event in the feed without scoring
            it. You can change points later on Activity.
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
      </DialogContent>
    </Dialog>
  );
}
