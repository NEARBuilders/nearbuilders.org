import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BarChart2,
  Bold,
  CheckCircle2,
  CheckSquare,
  Circle,
  Code2,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  Heading1,
  Italic,
  Layers,
  Link2,
  List,
  ListOrdered,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
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
import { fetchRepositoryReadme } from "@/lib/repository-content";
import { cn } from "@/lib/utils";

export type ProjectFormValues = {
  kind: "project" | "idea" | "scope" | "result";
  title: string;
  description?: string;
  repository?: string;
  content?: string;
  visibility: "private" | "unlisted" | "public";
  status?: "active" | "paused" | "archived";
  ownerId?: string;
  domain?: string;
};

export const validateTitle = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Title is required";
  if (trimmed.length > 200) return "Max 200 characters";
  return undefined;
};

export const validateDescription = (value?: string) => {
  if ((value ?? "").length > 1000) return "Max 1000 characters";
  return undefined;
};

export const validateRepository = (value: string | undefined, kind: ProjectFormValues["kind"]) => {
  const trimmed = value?.trim() ?? "";
  if (kind === "project" && !trimmed) return "Repository URL is required for projects";
  if (!trimmed) return undefined;
  if (trimmed.length > 500) return "Max 500 characters";
  try {
    new URL(trimmed);
    return undefined;
  } catch {
    return "Must be a valid URL";
  }
};

export const validateContent = (value: string | undefined, kind: ProjectFormValues["kind"]) => {
  const trimmed = value?.trim() ?? "";
  if ((kind === "idea" || kind === "scope" || kind === "result") && !trimmed)
    return `Markdown content is required for ${kind}s`;
  if ((value ?? "").length > 50000) return "Max 50,000 characters";
  return undefined;
};

export const validateOptionalMaxLength = (
  value: string | undefined,
  max: number,
  message: string,
) => {
  if ((value ?? "").length > max) return message;
  return undefined;
};

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
      description: "A shipped product or tool",
      icon: <FileCode2 size={15} />,
    },
    {
      value: "idea" as const,
      label: "Idea",
      description: "A concept worth exploring",
      icon: <FileText size={15} />,
    },
    {
      value: "scope" as const,
      label: "Scope",
      description: "A defined piece of work",
      icon: <Layers size={15} />,
    },
    {
      value: "result" as const,
      label: "Result",
      description: "A shipped outcome or learning",
      icon: <BarChart2 size={15} />,
    },
  ];
  const kindLabel = kindOptions.find((option) => option.value === kind)?.label ?? "Entry";
  const titleReady = Boolean(currentTitle.trim());
  const sourceReady = kind === "project" ? Boolean(repositoryUrl.trim()) : Boolean(content.trim());
  const identityReady = Boolean(defaultOwnerId || isAdmin);

  return (
    <div className="flex-1 bg-muted/40">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-7 lg:px-8">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-accent">
                    Step 1
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">Choose a format</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Start with the format that best describes what you are sharing.
                  </p>
                </div>
                <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {kindLabel}
                </span>
              </div>
              <form.Field name="kind">
                {(field: any) => (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {kindOptions.map((option) => {
                      const active = kind === option.value;
                      const optionClass = cn(
                        "flex min-h-20 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        active
                          ? "border-brand-accent bg-brand-accent-light"
                          : "border-border bg-background hover:border-border-strong hover:bg-muted",
                      );
                      const content = (
                        <>
                          <span
                            className={cn(
                              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                              active
                                ? "bg-brand-accent text-brand-mint-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {option.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-foreground">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                              {option.description}
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

            <div className="space-y-6 px-5 py-6 sm:px-7">
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
                    const err = fieldError(field.state.meta.errors[0]);
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
                          className={cn("h-12 text-base", err ? "border-destructive" : "")}
                          aria-invalid={Boolean(err)}
                        />
                        <div className="flex items-center justify-between gap-3">
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
                    const err = fieldError(field.state.meta.errors[0]);
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
                          className={cn("resize-none", err ? "border-destructive" : "")}
                          aria-invalid={Boolean(err)}
                        />
                        <div className="flex items-center justify-between gap-3">
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

          <section className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-5 sm:px-7">
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
            <div className="px-5 py-6 sm:px-7">
              {kind === "project" ? (
                <ProjectSourcePreview
                  form={form}
                  repositoryUrl={repositoryUrl}
                  readmeQuery={readmeQuery}
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
                    const err = fieldError(field.state.meta.errors[0]);
                    const placeholder =
                      kind === "scope"
                        ? "# Scope\n\nDefine the work, success criteria, and references e.g. @alice.near/my-idea…"
                        : kind === "result"
                          ? "# Results\n\nWhat was built, measured, and learned. Reference scopes with @alice.near/scope-slug…"
                          : "# My Idea\n\nDescribe the concept, motivation, and next steps…";
                    return (
                      <div className="overflow-hidden rounded-xl border border-border">
                        <div className="hidden min-h-[420px] lg:grid lg:grid-cols-2">
                          <div className="min-h-0 border-r border-border">
                            <ContentWriteTab
                              value={field.state.value ?? ""}
                              onChange={field.handleChange}
                              error={err}
                              placeholder={placeholder}
                            />
                          </div>
                          <MarkdownPreviewPanel content={field.state.value ?? ""} />
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

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
                  const err = fieldError(field.state.meta.errors[0]);
                  return (
                    <>
                      <Input
                        id="domain"
                        value={field.state.value ?? ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="example.com"
                        className={cn("mt-3 font-mono text-sm", err ? "border-destructive" : "")}
                        aria-invalid={Boolean(err)}
                      />
                      {err && <ErrorText>{err}</ErrorText>}
                    </>
                  );
                }}
              </form.Field>
            </section>
          )}

          {isAdmin && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
                  const err = fieldError(field.state.meta.errors[0]);
                  return (
                    <>
                      <Input
                        id="ownerId"
                        value={field.state.value ?? ""}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={defaultOwnerId || "example.near"}
                        className={cn("mt-3 font-mono text-sm", err ? "border-destructive" : "")}
                        aria-invalid={Boolean(err)}
                      />
                      {err && <ErrorText>{err}</ErrorText>}
                    </>
                  );
                }}
              </form.Field>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
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
}: {
  form: any;
  repositoryUrl: string;
  readmeQuery: any;
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
          const err = fieldError(field.state.meta.errors[0]);
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
                  className={cn("h-11 flex-1 font-mono text-sm", err ? "border-destructive" : "")}
                  aria-invalid={Boolean(err)}
                />
                <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-muted px-3 text-xs font-semibold text-muted-foreground">
                  <FileCode2 size={14} />
                  README source
                </span>
              </div>
              {err ? (
                <ErrorText>{err}</ErrorText>
              ) : (
                <HelperText>
                  We fetch the README from the default branch when the page is viewed.
                </HelperText>
              )}
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
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
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
    <div className="flex min-h-[55vh] flex-col lg:h-full lg:min-h-0">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-3 py-2.5 sm:px-4">
        {MARKDOWN_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.label}
              type="button"
              onClick={() => applyMarkdown(tool)}
              title={tool.label}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-foreground active:scale-95 [webkit-tap-highlight-color:transparent]"
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
        className={cn(
          "flex-1 w-full min-h-[320px] bg-muted text-foreground border-none outline-none resize-none font-mono text-[13px] leading-relaxed p-5",
          error ? "border-t-2 border-destructive" : "",
        )}
      />
      {error && (
        <div className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-8 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

function MarkdownPreviewPanel({ content, compact }: { content: string; compact?: boolean }) {
  return (
    <div className="flex min-h-[55vh] flex-col overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden">
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
