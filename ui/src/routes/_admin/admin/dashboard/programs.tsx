import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Pencil, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { RecordsState } from "@/components/admin/records-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { creditSettingsQueryOptions } from "@/lib/admin/credits-settings";
import {
  type AdminProgram,
  adminProgramsQueryKey,
  adminProgramsQueryOptions,
  draftToCreateInput,
  draftToUpdateInput,
  emptyProgramDraft,
  moveProgramId,
  nearAiCreditsDraft,
  PROGRAM_STATUS_ACTIONS,
  PROGRAM_STATUS_LABELS,
  type ProgramDraft,
  type ProgramStatus,
  programToDraft,
} from "@/lib/admin/programs";
import { dashboardTabTitle } from "@/lib/admin/proposal-tab-route";
import { buildTopics } from "@/lib/build-content";
import { pageHead } from "@/lib/page-meta";
import { PROGRAM_TYPE_LABELS, programDateLabel, programKeys } from "@/lib/queries/programs";

export const Route = createFileRoute("/_admin/admin/dashboard/programs")({
  head: () => ({ meta: pageHead({ title: dashboardTabTitle("Programs") }) }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery(adminProgramsQueryOptions(context.apiClient));
  },
  component: ProgramsTab,
});

type Editor = { mode: "create" } | { mode: "edit"; id: string };

const NO_TOPIC = "none";

function ProgramsTab() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const programsQuery = useQuery(adminProgramsQueryOptions(apiClient));
  const creditSettingsQuery = useQuery(creditSettingsQueryOptions(apiClient));
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState<ProgramDraft>(emptyProgramDraft);

  const programs = programsQuery.data ?? [];

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminProgramsQueryKey }),
      queryClient.invalidateQueries({ queryKey: programKeys.all }),
    ]);

  const save = useMutation({
    mutationFn: async (input: { editor: Editor; draft: ProgramDraft }) =>
      input.editor.mode === "create"
        ? apiClient.projects.createProgram(draftToCreateInput(input.draft))
        : apiClient.projects.updateProgram(draftToUpdateInput(input.editor.id, input.draft)),
    onSuccess: async () => {
      toast.success("Program saved");
      setEditor(null);
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: ProgramStatus }) =>
      apiClient.projects.updateProgram(input),
    onSuccess: async (program) => {
      toast.success(
        `${program.title} is now ${PROGRAM_STATUS_LABELS[program.status].toLowerCase()}`,
      );
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => apiClient.projects.reorderPrograms({ ids }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });

  const openCreate = (initial: ProgramDraft) => {
    setDraft(initial);
    setEditor({ mode: "create" });
  };

  const openEdit = (program: AdminProgram) => {
    setDraft(programToDraft(program));
    setEditor({ mode: "edit", id: program.id });
  };

  const ids = programs.map((program) => program.id);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-xl font-bold text-foreground">Partner programs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Listed programs that are open show on /build and on their project page. Closed ones drop
            off /build on their own and show as Closed on the project page for 30 days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openCreate(nearAiCreditsDraft(creditSettingsQuery.data?.settings ?? null))
            }
          >
            <Sparkles className="size-4" />
            NEAR AI credits
          </Button>
          <Button size="sm" onClick={() => openCreate(emptyProgramDraft())}>
            <Plus className="size-4" />
            New program
          </Button>
        </div>
      </div>

      {editor && (
        <ProgramEditor
          editor={editor}
          draft={draft}
          onChange={setDraft}
          onCancel={() => setEditor(null)}
          onSave={() => save.mutate({ editor, draft })}
          saving={save.isPending}
        />
      )}

      <RecordsState
        isLoading={programsQuery.isLoading}
        isError={programsQuery.isError}
        isEmpty={programs.length === 0}
        onRetry={() => void programsQuery.refetch()}
        loadingFallback={<Skeleton className="h-40 w-full" />}
        errorTitle="Programs could not be loaded"
        emptyTitle="No programs yet"
        emptyBody="Add one with New program, or start from the NEAR AI credits template."
      >
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {programs.map((program, index) => (
            <li
              key={program.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={program.status === "listed" ? "default" : "secondary"}>
                    {PROGRAM_STATUS_LABELS[program.status]}
                  </Badge>
                  <Badge variant="outline">{PROGRAM_TYPE_LABELS[program.type]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {program.state === "upcoming" ? "Not open yet" : programDateLabel(program)}
                  </span>
                </div>
                <p className="mt-2 truncate font-semibold text-foreground">{program.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {program.project.title}
                  {program.rewards ? ` · ${program.rewards}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${program.title} up`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => reorder.mutate(moveProgramId(ids, program.id, -1))}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${program.title} down`}
                  disabled={index === programs.length - 1 || reorder.isPending}
                  onClick={() => reorder.mutate(moveProgramId(ids, program.id, 1))}
                >
                  <ArrowDown className="size-4" />
                </Button>
                {PROGRAM_STATUS_ACTIONS[program.status].map((action) => (
                  <Button
                    key={action.status}
                    size="sm"
                    variant="outline"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: program.id, status: action.status })}
                  >
                    {action.label}
                  </Button>
                ))}
                <Button size="sm" variant="outline" onClick={() => openEdit(program)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </RecordsState>
    </section>
  );
}

function ProgramEditor({
  editor,
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  editor: Editor;
  draft: ProgramDraft;
  onChange: (draft: ProgramDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const field = <K extends keyof ProgramDraft>(key: K, value: ProgramDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const canSave =
    Boolean(draft.projectId) &&
    Boolean(draft.title.trim()) &&
    Boolean(draft.ctaLabel.trim()) &&
    Boolean(draft.ctaUrl.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {editor.mode === "create" ? "New program" : "Edit program"}
        </CardTitle>
        <CardDescription>
          The card takes its logo and name from the project. Use an https link or a path on this
          site such as /dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {editor.mode === "create" ? (
          <ProjectPicker
            projectId={draft.projectId}
            projectTitle={draft.projectTitle}
            onSelect={(projectId, projectTitle) => onChange({ ...draft, projectId, projectTitle })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Project: <span className="font-semibold text-foreground">{draft.projectTitle}</span>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="program-type">Type</Label>
            <Select
              value={draft.type}
              onValueChange={(value) => field("type", value as ProgramDraft["type"])}
            >
              <SelectTrigger id="program-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROGRAM_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-topic">Topic on /build (optional)</Label>
            <Select
              value={draft.topicId || NO_TOPIC}
              onValueChange={(value) =>
                field("topicId", value === NO_TOPIC ? "" : (value as ProgramDraft["topicId"]))
              }
            >
              <SelectTrigger id="program-topic" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TOPIC}>No topic</SelectItem>
                {buildTopics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="program-title">Title</Label>
          <Input
            id="program-title"
            maxLength={120}
            value={draft.title}
            onChange={(event) => field("title", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="program-summary">Summary (optional)</Label>
          <Textarea
            id="program-summary"
            maxLength={500}
            value={draft.summary}
            onChange={(event) => field("summary", event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="program-rewards">Rewards (optional)</Label>
            <Input
              id="program-rewards"
              maxLength={200}
              value={draft.rewards}
              onChange={(event) => field("rewards", event.target.value)}
              placeholder="$500 in cloud credits"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-eligibility">Eligibility (optional)</Label>
            <Input
              id="program-eligibility"
              maxLength={200}
              value={draft.eligibility}
              onChange={(event) => field("eligibility", event.target.value)}
              placeholder="Approved NEAR Builders"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="program-cta-label">Button label</Label>
            <Input
              id="program-cta-label"
              maxLength={40}
              value={draft.ctaLabel}
              onChange={(event) => field("ctaLabel", event.target.value)}
              placeholder="Apply"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-cta-url">Button link</Label>
            <Input
              id="program-cta-url"
              maxLength={500}
              value={draft.ctaUrl}
              onChange={(event) => field("ctaUrl", event.target.value)}
              placeholder="https://… or /dashboard"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="program-opens-at">Opens (optional)</Label>
            <Input
              id="program-opens-at"
              type="datetime-local"
              value={draft.opensAt}
              onChange={(event) => field("opensAt", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-closes-at">Closes (empty = rolling)</Label>
            <Input
              id="program-closes-at"
              type="datetime-local"
              value={draft.closesAt}
              onChange={(event) => field("closesAt", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="program-status">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(value) => field("status", value as ProgramStatus)}
            >
              <SelectTrigger id="program-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROGRAM_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!canSave || saving} onClick={onSave}>
            {saving ? "Saving…" : "Save program"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectPicker({
  projectId,
  projectTitle,
  onSelect,
}: {
  projectId: string;
  projectTitle: string;
  onSelect: (projectId: string, projectTitle: string) => void;
}) {
  const apiClient = useApiClient();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const results = useQuery({
    queryKey: ["admin", "program-project-search", trimmed],
    queryFn: async () =>
      (await apiClient.listProjects({ kind: "project", query: trimmed, limit: 8 })).data,
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-2">
      <Label htmlFor="program-project">Project</Label>
      {projectId && (
        <p className="text-sm text-muted-foreground">
          Selected: <span className="font-semibold text-foreground">{projectTitle}</span>
        </p>
      )}
      <Input
        id="program-project"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search projects by name"
      />
      {trimmed.length >= 2 && (
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {results.isLoading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          ) : (results.data ?? []).length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No projects found</li>
          ) : (
            results.data?.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  onClick={() => {
                    onSelect(project.id, project.title);
                    setQuery("");
                  }}
                >
                  <span className="truncate font-semibold text-foreground">{project.title}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {project.slug}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
