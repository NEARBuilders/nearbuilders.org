import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BarChart2,
  Bold,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Code2,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  GripVertical,
  Heading1,
  Italic,
  Layers,
  Link2,
  List,
  ListOrdered,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Input } from "@/components";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/ui/markdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { parseDescriptionFromContent, parseTitleFromContent } from "@/lib/project-content";
import {
  getProjectFormValidation,
  type ProjectFormValues,
  validateContent,
  validateDescription,
  validateOptionalMaxLength,
  validateRepository,
  validateTitle,
} from "@/lib/project-form-validation";
import { fetchRepositoryReadme } from "@/lib/repository-content";
import { cn } from "@/lib/utils";

export type { ProjectFormValues } from "@/lib/project-form-validation";
export {
  validateContent,
  validateDescription,
  validateOptionalMaxLength,
  validateRepository,
  validateTitle,
} from "@/lib/project-form-validation";

const EDITOR_SPLIT_STORAGE_KEY = "projects:creator:editor-split";
const DEFAULT_EDITOR_SPLIT = 50;
const MIN_EDITOR_SPLIT = 30;
const MAX_EDITOR_SPLIT = 70;

export function clampProjectEditorSplit(value: number) {
  return Math.min(MAX_EDITOR_SPLIT, Math.max(MIN_EDITOR_SPLIT, value));
}

export function fieldError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (Array.isArray(error)) {
    for (const issue of error) {
      const message = fieldError(issue);
      if (message) return message;
    }
    return undefined;
  }
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function fieldStateClassName(
  value: unknown,
  error: string | undefined,
  required: boolean,
  enabled: boolean,
) {
  if (!enabled) return error ? "border-destructive" : "";
  const filled = typeof value === "string" ? value.trim().length > 0 : Boolean(value);
  if (error || (required && !filled)) return "border-destructive";
  if (filled) return "border-brand-accent";
  return "";
}

interface ProjectFormLayoutProps {
  form: any;
  mode: "create" | "edit";
  isAdmin: boolean;
  defaultOwnerId: string;
  tab: "write" | "preview";
  slugPreview?: string;
  currentKind?: string;
}

export function ProjectFormLayout({
  form,
  mode,
  isAdmin,
  defaultOwnerId,
  tab,
  slugPreview,
  currentKind,
}: ProjectFormLayoutProps) {
  const formKind = useStore(form.store, (s: any) => s.values.kind);
  const kind = mode === "create" && currentKind ? currentKind : formKind;
  const repositoryUrl = useStore(form.store, (s: any) => s.values.repository ?? "");

  const readmeQuery = useQuery({
    queryKey: ["projectFormReadme", repositoryUrl],
    queryFn: async () => {
      if (!repositoryUrl.trim()) return null;
      return await fetchRepositoryReadme(repositoryUrl.trim());
    },
    enabled: kind === "project" && Boolean(repositoryUrl?.trim()),
  });

  const content = useStore(form.store, (s: any) => s.values.content ?? "");
  const currentTitle = useStore(form.store, (s: any) => s.values.title ?? "");
  const currentDescription = useStore(form.store, (s: any) => s.values.description ?? "");
  const formValues = useStore(form.store, (s: any) => s.values) as Partial<ProjectFormValues>;
  const validation = getProjectFormValidation({
    ...formValues,
    kind: kind as ProjectFormValues["kind"],
  });
  const creatorMode = mode === "create";
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [editorSplit, setEditorSplit] = useState(DEFAULT_EDITOR_SPLIT);
  const [editorSplitReady, setEditorSplitReady] = useState(false);
  const [resizingPointerId, setResizingPointerId] = useState<number>();
  const [metadataCollapsed, setMetadataCollapsed] = useState(false);

  useEffect(() => {
    if (!creatorMode) return;
    try {
      const storedValue = sessionStorage.getItem(EDITOR_SPLIT_STORAGE_KEY);
      if (storedValue !== null) {
        const storedSplit = Number(storedValue);
        if (Number.isFinite(storedSplit)) {
          setEditorSplit(clampProjectEditorSplit(storedSplit));
        }
      }
    } catch {}
    setEditorSplitReady(true);
  }, [creatorMode]);

  useEffect(() => {
    if (!creatorMode || !editorSplitReady) return;
    try {
      sessionStorage.setItem(EDITOR_SPLIT_STORAGE_KEY, String(Math.round(editorSplit)));
    } catch {}
  }, [creatorMode, editorSplit, editorSplitReady]);

  const updateEditorSplit = (clientX: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const { left, width } = container.getBoundingClientRect();
    if (!width) return;
    setEditorSplit(clampProjectEditorSplit(((clientX - left) / width) * 100));
  };

  const titleClearedRef = useRef(false);
  const prevTitleRef = useRef(currentTitle);

  useEffect(() => {
    if (prevTitleRef.current && !currentTitle) {
      titleClearedRef.current = true;
    }
    if (currentTitle) {
      titleClearedRef.current = false;
    }
    prevTitleRef.current = currentTitle;
  }, [currentTitle]);

  const descriptionClearedRef = useRef(false);
  const prevDescriptionRef = useRef(currentDescription);

  useEffect(() => {
    if (prevDescriptionRef.current && !currentDescription) {
      descriptionClearedRef.current = true;
    }
    if (currentDescription) {
      descriptionClearedRef.current = false;
    }
    prevDescriptionRef.current = currentDescription;
  }, [currentDescription]);

  useEffect(() => {
    if (kind === "project") return;
    if (!content.trim()) return;

    const parsedTitle = parseTitleFromContent(content);
    const parsedDescription = parseDescriptionFromContent(content);

    if (parsedTitle && !currentTitle && !titleClearedRef.current) {
      form.setFieldValue("title", parsedTitle);
    }
    if (parsedDescription && !currentDescription && !descriptionClearedRef.current) {
      form.setFieldValue("description", parsedDescription);
    }
  }, [content, currentTitle, currentDescription, kind, form]);

  const kindOptions = [
    {
      value: "project" as const,
      label: "Project",
      icon: <FileCode2 size={15} />,
    },
    {
      value: "idea" as const,
      label: "Idea",
      icon: <FileText size={15} />,
    },
    {
      value: "scope" as const,
      label: "Scope",
      icon: <Layers size={15} />,
    },
    {
      value: "result" as const,
      label: "Result",
      icon: <BarChart2 size={15} />,
    },
  ];
  const kindLabel = kindOptions.find((option) => option.value === kind)?.label ?? "Entry";
  const titleReady = !validation.errors.title;
  const metadataReady = titleReady && !validation.errors.description;
  const sourceReady =
    kind === "project" ? !validation.errors.repository : !validation.errors.content;
  const identityReady = Boolean(defaultOwnerId || isAdmin);

  useEffect(() => {
    if (!metadataReady && metadataCollapsed) setMetadataCollapsed(false);
  }, [metadataCollapsed, metadataReady]);

  return (
    <div className={cn("flex-1 bg-muted/40", mode === "create" && "pb-24 sm:pb-0")}>
      <div
        className={cn(
          "mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 sm:gap-5 sm:px-6 sm:py-7 lg:px-8",
          creatorMode
            ? "lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-5"
            : "lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-7",
        )}
      >
        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-card shadow-sm sm:rounded-2xl">
            <div className="border-b border-border px-4 py-4 sm:px-7 sm:py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                {creatorMode && metadataCollapsed ? (
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-accent">
                      Details complete
                    </p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-foreground">
                      {currentTitle}
                    </h2>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                      {currentDescription || "No short description added."}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-accent">
                      Step 1
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-foreground">Choose a format</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Start with the format that best describes what you are sharing.
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {kindLabel}
                  </span>
                  {creatorMode && (
                    <button
                      type="button"
                      onClick={() => setMetadataCollapsed((collapsed) => !collapsed)}
                      disabled={!metadataReady}
                      aria-controls="project-metadata-fields"
                      aria-expanded={!metadataCollapsed}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-border-strong hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                      {metadataCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      {metadataCollapsed ? "Edit details" : "Collapse"}
                    </button>
                  )}
                </div>
              </div>
              <form.Field name="kind">
                {(field: any) => (
                  <div
                    className={cn(
                      "mt-4 grid grid-cols-2 gap-2 sm:mt-5 xl:grid-cols-4",
                      creatorMode && metadataCollapsed && "hidden",
                    )}
                  >
                    {kindOptions.map((option) => {
                      const active = kind === option.value;
                      const optionClass = cn(
                        "flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-16 sm:justify-start sm:gap-3 sm:rounded-xl sm:px-3.5 sm:py-3",
                        active
                          ? "border-brand-accent bg-brand-accent-light"
                          : "border-border bg-background hover:border-border-strong hover:bg-muted",
                      );
                      const content = (
                        <>
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-md sm:size-7 sm:rounded-lg",
                              active
                                ? "bg-brand-accent text-brand-mint-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {option.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-bold text-foreground sm:text-sm">
                              {option.label}
                            </span>
                          </span>
                        </>
                      );

                      if (mode === "create") {
                        return (
                          <Link
                            key={option.value}
                            to="/projects/new/$kind"
                            params={{ kind: option.value }}
                            search={(prev) => ({ ...prev, tab: "write" })}
                            replace
                            onClick={() => field.handleChange(option.value)}
                            className={optionClass}
                            aria-current={active ? "page" : undefined}
                          >
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => field.handleChange(option.value)}
                          className={optionClass}
                          aria-pressed={active}
                        >
                          {content}
                        </button>
                      );
                    })}
                  </div>
                )}
              </form.Field>
            </div>

            <div
              id="project-metadata-fields"
              className={cn(
                "space-y-5 px-4 py-5 sm:space-y-6 sm:px-7 sm:py-6",
                creatorMode && metadataCollapsed && "hidden",
              )}
            >
              <FormSectionHeading
                eyebrow="Step 2"
                title="Tell people what it is"
                description="These details appear first in the directory and on the detail page."
              />

              <div className="space-y-5">
                <form.Field
                  name="title"
                  validators={{
                    onChange: ({ value }: any) => validateTitle(value),
                    onSubmit: ({ value }: any) => validateTitle(value),
                  }}
                >
                  {(field: any) => {
                    const err =
                      fieldError(field.state.meta.errors[0]) ??
                      (creatorMode ? validation.errors.title : undefined);
                    return (
                      <div className="space-y-2">
                        <FieldLabel htmlFor="title" required>
                          Title
                        </FieldLabel>
                        <Input
                          id="title"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={
                            kind === "project"
                              ? "NEAR analytics"
                              : kind === "idea"
                                ? "On-chain social graphs"
                                : kind === "scope"
                                  ? "MVP auth flow"
                                  : "Q1 builder growth"
                          }
                          maxLength={200}
                          className={cn(
                            "h-12 text-base",
                            fieldStateClassName(field.state.value, err, true, creatorMode),
                          )}
                          aria-invalid={Boolean(err)}
                          aria-describedby="title-feedback"
                        />
                        <div
                          id="title-feedback"
                          className="flex items-center justify-between gap-3"
                        >
                          {err ? (
                            <ErrorText>{err}</ErrorText>
                          ) : (
                            <HelperText>A clear, specific name works best.</HelperText>
                          )}
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {currentTitle.length}/200
                          </span>
                        </div>
                        {slugPreview !== undefined && (
                          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">URL</span>
                            <span className="truncate font-mono">
                              /projects/{kind}/{slugPreview || "your-title"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                </form.Field>

                <form.Field
                  name="description"
                  validators={{
                    onChange: ({ value }: any) => validateDescription(value),
                    onSubmit: ({ value }: any) => validateDescription(value),
                  }}
                >
                  {(field: any) => {
                    const err =
                      fieldError(field.state.meta.errors[0]) ??
                      (creatorMode ? validation.errors.description : undefined);
                    return (
                      <div className="space-y-2">
                        <FieldLabel htmlFor="description">Short description</FieldLabel>
                        <Textarea
                          id="description"
                          value={field.state.value ?? ""}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Summarize the problem, outcome, or opportunity in one or two sentences."
                          rows={4}
                          maxLength={1000}
                          className={cn(
                            "resize-none",
                            fieldStateClassName(field.state.value, err, false, creatorMode),
                          )}
                          aria-invalid={Boolean(err)}
                          aria-describedby="description-feedback"
                        />
                        <div
                          id="description-feedback"
                          className="flex items-center justify-between gap-3"
                        >
                          {err ? (
                            <ErrorText>{err}</ErrorText>
                          ) : (
                            <HelperText>Optional, but helpful in the directory.</HelperText>
                          )}
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {currentDescription.length}/1000
                          </span>
                        </div>
                      </div>
                    );
                  }}
                </form.Field>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm sm:rounded-2xl">
            <div className="border-b border-border px-4 py-4 sm:px-7 sm:py-5">
              <FormSectionHeading
                eyebrow="Step 3"
                title={kind === "project" ? "Connect the source" : "Write the details"}
                description={
                  kind === "project"
                    ? "Your README becomes the project page content automatically."
                    : "Use Markdown to explain the context, work, and references."
                }
              />
            </div>
            <div className="px-4 py-5 sm:px-7 sm:py-6">
              {kind === "project" ? (
                <ProjectSourcePreview
                  form={form}
                  repositoryUrl={repositoryUrl}
                  readmeQuery={readmeQuery}
                  validationError={creatorMode ? validation.errors.repository : undefined}
                  showValidationState={creatorMode}
                />
              ) : (
                <form.Field
                  name="content"
                  validators={{
                    onChangeListenTo: ["kind"],
                    onChange: ({ value }: any) => validateContent(value, kind),
                    onSubmit: ({ value }: any) => validateContent(value, kind),
                  }}
                >
                  {(field: any) => {
                    const err =
                      fieldError(field.state.meta.errors[0]) ??
                      (creatorMode ? validation.errors.content : undefined);
                    const placeholder =
                      kind === "scope"
                        ? "# Scope\n\nDefine the work, success criteria, and references e.g. @alice.near/my-idea…"
                        : kind === "result"
                          ? "# Results\n\nWhat was built, measured, and learned. Reference scopes with @alice.near/scope-slug…"
                          : "# My Idea\n\nDescribe the concept, motivation, and next steps…";
                    return (
                      <div
                        className={cn(
                          "overflow-hidden rounded-xl border border-border",
                          creatorMode &&
                            (err
                              ? "border-destructive"
                              : content.trim()
                                ? "border-brand-accent"
                                : ""),
                        )}
                      >
                        <div
                          ref={splitContainerRef}
                          className={cn(
                            "hidden min-h-[420px] lg:grid",
                            resizingPointerId !== undefined && "select-none",
                          )}
                          style={{
                            gridTemplateColumns: creatorMode
                              ? `minmax(0, ${editorSplit}fr) auto minmax(0, ${100 - editorSplit}fr)`
                              : "minmax(0, 1fr) minmax(0, 1fr)",
                          }}
                        >
                          <div
                            className={cn(
                              "min-h-0 min-w-0",
                              !creatorMode && "border-r border-border",
                            )}
                          >
                            <ContentWriteTab
                              value={field.state.value ?? ""}
                              onChange={field.handleChange}
                              error={err}
                              placeholder={placeholder}
                              errorId="content-feedback"
                            />
                          </div>
                          {creatorMode && (
                            <div className="relative flex w-3 items-center justify-center">
                              <hr
                                tabIndex={0}
                                aria-label="Resize editor and preview"
                                aria-orientation="vertical"
                                aria-valuemin={MIN_EDITOR_SPLIT}
                                aria-valuemax={MAX_EDITOR_SPLIT}
                                aria-valuenow={Math.round(editorSplit)}
                                aria-valuetext={`${Math.round(editorSplit)}% editor, ${100 - Math.round(editorSplit)}% preview`}
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  event.currentTarget.setPointerCapture(event.pointerId);
                                  setResizingPointerId(event.pointerId);
                                  updateEditorSplit(event.clientX);
                                }}
                                onPointerMove={(event) => {
                                  if (resizingPointerId === event.pointerId) {
                                    updateEditorSplit(event.clientX);
                                  }
                                }}
                                onPointerUp={(event) => {
                                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                                    event.currentTarget.releasePointerCapture(event.pointerId);
                                  }
                                  setResizingPointerId(undefined);
                                }}
                                onPointerCancel={() => setResizingPointerId(undefined)}
                                onKeyDown={(event) => {
                                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                                    event.preventDefault();
                                    setEditorSplit((split) =>
                                      clampProjectEditorSplit(
                                        split + (event.key === "ArrowLeft" ? -5 : 5),
                                      ),
                                    );
                                  }
                                  if (event.key === "Home" || event.key === "End") {
                                    event.preventDefault();
                                    setEditorSplit(
                                      event.key === "Home" ? MIN_EDITOR_SPLIT : MAX_EDITOR_SPLIT,
                                    );
                                  }
                                }}
                                className="peer absolute inset-0 m-0 h-full w-full cursor-col-resize border-x border-y-0 border-border bg-muted/30 outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                              />
                              <GripVertical className="pointer-events-none relative size-4 text-muted-foreground transition-colors peer-hover:text-foreground" />
                            </div>
                          )}
                          <div className="min-h-0 min-w-0">
                            <MarkdownPreviewPanel content={field.state.value ?? ""} />
                          </div>
                        </div>

                        <Tabs value={tab} className="flex flex-col gap-0 lg:hidden">
                          <div className="border-b border-border bg-muted/50">
                            <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-none bg-transparent px-2">
                              {(["write", "preview"] as const).map((t) => (
                                <TabsTrigger
                                  key={t}
                                  value={t}
                                  asChild
                                  className="rounded-none border-b-2 border-l-0 border-r-0 border-t-0 px-4 py-3 text-[13px] font-semibold data-[state=active]:border-primary data-[state=inactive]:border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                                >
                                  <Link to="." search={(prev) => ({ ...prev, tab: t })} replace>
                                    {t === "write" ? "Write" : "Preview"}
                                  </Link>
                                </TabsTrigger>
                              ))}
                            </TabsList>
                          </div>
                          <TabsContent value="write" className="m-0">
                            <ContentWriteTab
                              value={field.state.value ?? ""}
                              onChange={field.handleChange}
                              error={err}
                              placeholder={placeholder}
                              errorId="content-feedback-mobile"
                            />
                          </TabsContent>
                          <TabsContent value="preview" className="m-0">
                            <MarkdownPreviewPanel content={field.state.value ?? ""} compact />
                          </TabsContent>
                        </Tabs>
                      </div>
                    );
                  }}
                </form.Field>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:space-y-5 lg:self-start">
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent-light text-brand-accent">
                <ShieldCheck size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">Publishing</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Choose who can find this entry after you save it.
                </p>
              </div>
            </div>

            <form.Field name="visibility">
              {(field: any) => (
                <div className="mt-5 space-y-2" role="radiogroup" aria-label="Visibility">
                  {(
                    [
                      {
                        value: "public" as const,
                        label: "Public",
                        desc: isAdmin ? "Visible in the directory" : "Visible after review",
                        icon: <Eye size={15} />,
                      },
                      {
                        value: "unlisted" as const,
                        label: "Unlisted",
                        desc: "Direct link only",
                        icon: <ExternalLink size={15} />,
                      },
                      {
                        value: "private" as const,
                        label: "Private",
                        desc: "Only you can see it",
                        icon: <Circle size={15} />,
                      },
                    ] as const
                  ).map((option) => {
                    const active = field.state.value === option.value;
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                          active
                            ? "border-brand-accent bg-brand-accent-light"
                            : "border-border bg-background hover:border-border-strong hover:bg-muted",
                        )}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          value={option.value}
                          checked={active}
                          onChange={() => field.handleChange(option.value)}
                          className="sr-only"
                        />
                        <span
                          className={cn(active ? "text-brand-accent" : "text-muted-foreground")}
                        >
                          {option.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-foreground">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {option.desc}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "size-4 rounded-full border",
                            active ? "border-brand-accent bg-brand-accent" : "border-border-strong",
                          )}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </form.Field>
          </section>

          {mode === "edit" && kind !== "result" && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
              <FieldLabel>Status</FieldLabel>
              <p className="mt-1 text-xs text-muted-foreground">Show where this work is today.</p>
              <form.Field name="status">
                {(field: any) => (
                  <Select
                    value={field.state.value ?? "active"}
                    onValueChange={(value) => field.handleChange(value)}
                  >
                    <SelectTrigger className="mt-3 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </form.Field>
            </section>
          )}

          {kind === "idea" && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
              <FieldLabel htmlFor="domain">Domain</FieldLabel>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Add a live domain if this idea already has a home on the web.
              </p>
              <form.Field
                name="domain"
                validators={{
                  onChange: ({ value }: any) =>
                    validateOptionalMaxLength(value, 255, "Max 255 characters"),
                  onSubmit: ({ value }: any) =>
                    validateOptionalMaxLength(value, 255, "Max 255 characters"),
                }}
              >
                {(field: any) => {
                  const err =
                    fieldError(field.state.meta.errors[0]) ??
                    (creatorMode ? validation.errors.domain : undefined);
                  return (
                    <>
                      <Input
                        id="domain"
                        value={field.state.value ?? ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="example.com"
                        className={cn(
                          "mt-3 font-mono text-sm",
                          fieldStateClassName(field.state.value, err, false, creatorMode),
                        )}
                        aria-invalid={Boolean(err)}
                        aria-describedby={err ? "domain-feedback" : undefined}
                      />
                      {err && (
                        <div id="domain-feedback">
                          <ErrorText>{err}</ErrorText>
                        </div>
                      )}
                    </>
                  );
                }}
              </form.Field>
            </section>
          )}

          {isAdmin && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:rounded-2xl sm:p-6">
              <FieldLabel htmlFor="ownerId">Owner</FieldLabel>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Assign this entry to a NEAR account. Leave blank to use your account.
              </p>
              <form.Field
                name="ownerId"
                validators={{
                  onChange: ({ value }: any) =>
                    validateOptionalMaxLength(value, 255, "Max 255 characters"),
                  onSubmit: ({ value }: any) =>
                    validateOptionalMaxLength(value, 255, "Max 255 characters"),
                }}
              >
                {(field: any) => {
                  const err =
                    fieldError(field.state.meta.errors[0]) ??
                    (creatorMode ? validation.errors.ownerId : undefined);
                  return (
                    <>
                      <Input
                        id="ownerId"
                        value={field.state.value ?? ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={defaultOwnerId || "example.near"}
                        className={cn(
                          "mt-3 font-mono text-sm",
                          fieldStateClassName(field.state.value, err, false, creatorMode),
                        )}
                        aria-invalid={Boolean(err)}
                        aria-describedby={err ? "owner-feedback" : undefined}
                      />
                      {err && (
                        <div id="owner-feedback">
                          <ErrorText>{err}</ErrorText>
                        </div>
                      )}
                    </>
                  );
                }}
              </form.Field>
            </section>
          )}

          <section className="hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:block sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Ready to share?</h2>
              <span className="text-xs font-semibold text-muted-foreground">
                {[titleReady, sourceReady, identityReady].filter(Boolean).length}/3
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <ChecklistItem complete={titleReady} label="Add a title" />
              <ChecklistItem
                complete={sourceReady}
                label={kind === "project" ? "Connect a repository" : "Add Markdown content"}
              />
              <ChecklistItem complete={identityReady} label="Link a NEAR account" />
            </div>
            {!identityReady && (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                Link a NEAR account in settings before creating an entry.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function FormSectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-accent">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function FieldLabel({
  children,
  required,
  ...props
}: React.ComponentProps<typeof Label> & { required?: boolean }) {
  return (
    <Label {...props}>
      {children}
      {required && <span className="text-brand-accent">*</span>}
    </Label>
  );
}

function ChecklistItem({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {complete ? (
        <CheckCircle2 className="size-4 shrink-0 text-brand-accent" />
      ) : (
        <Circle className="size-4 shrink-0 text-border-strong" />
      )}
      <span className={cn(complete ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
}

function ProjectSourcePreview({
  form,
  repositoryUrl,
  readmeQuery,
  validationError,
  showValidationState,
}: {
  form: any;
  repositoryUrl: string;
  readmeQuery: any;
  validationError?: string;
  showValidationState: boolean;
}) {
  return (
    <div className="space-y-4">
      <form.Field
        name="repository"
        validators={{
          onChangeListenTo: ["kind"],
          onChange: ({ value }: any) => validateRepository(value, "project"),
          onSubmit: ({ value }: any) => validateRepository(value, "project"),
        }}
      >
        {(field: any) => {
          const err = fieldError(field.state.meta.errors[0]) ?? validationError;
          return (
            <div className="space-y-2">
              <FieldLabel htmlFor="repository" required>
                Repository URL
              </FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="repository"
                  type="url"
                  value={field.state.value ?? ""}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="https://github.com/near/example"
                  className={cn(
                    "h-11 flex-1 font-mono text-sm",
                    fieldStateClassName(field.state.value, err, true, showValidationState),
                  )}
                  aria-invalid={Boolean(err)}
                  aria-describedby="repository-feedback"
                />
                <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-muted px-3 text-xs font-semibold text-muted-foreground">
                  <FileCode2 size={14} />
                  README source
                </span>
              </div>
              <div id="repository-feedback">
                {err ? (
                  <ErrorText>{err}</ErrorText>
                ) : (
                  <HelperText>
                    We fetch the README from the default branch when the page is viewed.
                  </HelperText>
                )}
              </div>
            </div>
          );
        }}
      </form.Field>

      <div className="rounded-xl border border-border bg-muted/50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">README preview</span>
          </div>
          {readmeQuery.isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
        </div>
        <div className="max-h-[430px] overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {repositoryUrl.trim() ? (
            readmeQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-1/3 animate-pulse rounded bg-border" />
                <div className="h-3 w-full animate-pulse rounded bg-border" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-border" />
              </div>
            ) : readmeQuery.data ? (
              <Markdown content={readmeQuery.data} />
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No README is available yet. The repository URL will still be saved.
              </div>
            )
          ) : (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 text-center">
              <FileCode2 size={24} className="text-border-strong" />
              <p className="text-sm font-semibold text-foreground">
                Add a repository to preview it
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                The README will become the main content of this project page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ContentWriteTab({
  value,
  onChange,
  error,
  placeholder,
  errorId,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  errorId?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyMarkdown = (tool: MarkdownTool) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selectedText = value.slice(start, end);
    const nextValue = tool.apply(value, selectedText, start, end);
    onChange(nextValue.text);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextValue.selectionStart, nextValue.selectionEnd);
    });
  };

  return (
    <div className="flex min-h-[50vh] flex-col sm:min-h-[55vh] lg:h-full lg:min-h-0">
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-border bg-card px-3 py-2.5 sm:px-4">
        {MARKDOWN_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.label}
              type="button"
              onClick={() => applyMarkdown(tool)}
              title={tool.label}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground active:scale-95 [webkit-tap-highlight-color:transparent]"
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          placeholder ?? "# My Idea\n\nDescribe the concept, motivation, and next steps…"
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "flex-1 w-full min-h-[280px] bg-muted text-foreground border-none outline-none resize-none font-mono text-[13px] leading-relaxed p-4 sm:min-h-[320px] sm:p-5",
          error ? "border-t-2 border-destructive" : "",
        )}
      />
      {error && (
        <div
          id={errorId}
          className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive sm:px-8"
        >
          {error}
        </div>
      )}
    </div>
  );
}

function MarkdownPreviewPanel({ content, compact }: { content: string; compact?: boolean }) {
  return (
    <div className="flex min-h-[50vh] flex-col overflow-visible sm:min-h-[55vh] lg:min-h-0 lg:flex-1 lg:overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
        <FileText size={14} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Live Preview</span>
      </div>
      <div
        className={cn(
          "overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-y-auto",
          compact ? "px-4 py-5 sm:px-6" : "px-4 py-5 sm:px-8 sm:py-6",
        )}
      >
        {content.trim() ? (
          <Markdown content={content} />
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Start writing to see the preview.
          </div>
        )}
      </div>
    </div>
  );
}

type MarkdownToolResult = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

type MarkdownTool = {
  label: string;
  icon: typeof Bold;
  apply: (value: string, selection: string, start: number, end: number) => MarkdownToolResult;
};

function replaceSelection(
  value: string,
  start: number,
  end: number,
  replacement: string,
  selectionStart = start,
  selectionEnd = start + replacement.length,
): MarkdownToolResult {
  return {
    text: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart,
    selectionEnd,
  };
}

function wrapSelection(
  value: string,
  selection: string,
  start: number,
  end: number,
  before: string,
  after: string,
  fallback: string,
): MarkdownToolResult {
  const inner = selection || fallback;
  const replacement = `${before}${inner}${after}`;
  const cursorStart = start + before.length;
  return replaceSelection(value, start, end, replacement, cursorStart, cursorStart + inner.length);
}

const MARKDOWN_TOOLS: MarkdownTool[] = [
  {
    label: "Heading",
    icon: Heading1,
    apply: (value, selection, start, end) => {
      const inner = selection || "Heading";
      const replacement = `# ${inner}`;
      return replaceSelection(
        value,
        start,
        end,
        replacement,
        start + 2,
        start + replacement.length,
      );
    },
  },
  {
    label: "Bold",
    icon: Bold,
    apply: (value, selection, start, end) =>
      wrapSelection(value, selection, start, end, "**", "**", "bold text"),
  },
  {
    label: "Italic",
    icon: Italic,
    apply: (value, selection, start, end) =>
      wrapSelection(value, selection, start, end, "*", "*", "italic text"),
  },
  {
    label: "Link",
    icon: Link2,
    apply: (value, selection, start, end) =>
      wrapSelection(value, selection, start, end, "[", "](https://)", "link text"),
  },
  {
    label: "Code",
    icon: Code2,
    apply: (value, selection, start, end) =>
      wrapSelection(value, selection, start, end, "`", "`", "code"),
  },
  {
    label: "Quote",
    icon: Quote,
    apply: (value, selection, start, end) => {
      const inner = selection || "Quoted thought";
      const replacement = inner
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return replaceSelection(
        value,
        start,
        end,
        replacement,
        start + 2,
        start + replacement.length,
      );
    },
  },
  {
    label: "Bullet List",
    icon: List,
    apply: (value, selection, start, end) => {
      const inner = selection || "List item";
      const replacement = inner
        .split("\n")
        .map((line) => `- ${line}`)
        .join("\n");
      return replaceSelection(
        value,
        start,
        end,
        replacement,
        start + 2,
        start + replacement.length,
      );
    },
  },
  {
    label: "Numbered List",
    icon: ListOrdered,
    apply: (value, selection, start, end) => {
      const inner = selection || "List item";
      const replacement = inner
        .split("\n")
        .map((line, index) => `${index + 1}. ${line}`)
        .join("\n");
      return replaceSelection(
        value,
        start,
        end,
        replacement,
        start + 3,
        start + replacement.length,
      );
    },
  },
  {
    label: "Checklist",
    icon: CheckSquare,
    apply: (value, selection, start, end) => {
      const inner = selection || "Checklist item";
      const replacement = inner
        .split("\n")
        .map((line) => `- [ ] ${line}`)
        .join("\n");
      return replaceSelection(
        value,
        start,
        end,
        replacement,
        start + 6,
        start + replacement.length,
      );
    },
  },
];

export function FormLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <Label htmlFor={htmlFor}>{children}</Label>;
}

export function HelperText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground mt-1">{children}</p>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-destructive mt-1">{children}</p>;
}

export function NearTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  error,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  error?: boolean;
}) {
  return (
    <Textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "resize-none",
        error ? "border-destructive focus-visible:border-destructive" : "",
      )}
    />
  );
}

export function NearSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
