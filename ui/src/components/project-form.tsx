import { useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
  Bold,
  CheckSquare,
  Code2,
  FileCode2,
  FileText,
  Heading1,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { type ReactNode, useRef } from "react";
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
import { fetchRepositoryReadme } from "@/lib/repository-content";
import { cn } from "@/lib/utils";

export type ProjectFormValues = {
  kind: "project" | "idea";
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
  if (kind === "idea" && !trimmed) return "Markdown content is required for ideas";
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
  setTab: (tab: "write" | "preview") => void;
  slugPreview?: string;
}

export function ProjectFormLayout({
  form,
  mode,
  isAdmin,
  defaultOwnerId,
  tab,
  setTab,
  slugPreview,
}: ProjectFormLayoutProps) {
  const kind = useStore(form.store, (s: any) => s.values.kind);
  const repositoryUrl = useStore(form.store, (s: any) => s.values.repository ?? "");

  const readmeQuery = useQuery({
    queryKey: ["projectFormReadme", repositoryUrl],
    queryFn: async () => {
      if (!repositoryUrl.trim()) return null;
      return await fetchRepositoryReadme(repositoryUrl.trim());
    },
    enabled: kind === "project" && Boolean(repositoryUrl?.trim()),
  });

  return (
    <div className="flex flex-1 flex-col overflow-visible lg:min-h-0 lg:overflow-hidden lg:flex-row">
      <div className="overflow-visible border-b border-border bg-card px-4 py-5 sm:px-6 sm:py-6 lg:overflow-y-auto lg:w-[340px] lg:border-b-0 lg:border-r lg:shrink-0 xl:w-[360px]">
        <div className="space-y-5 pb-[env(safe-area-inset-bottom,0px)] lg:pb-0">
          <form.Field name="kind">
            {(field: any) => (
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        value: "project" as const,
                        label: "Project",
                        icon: <FileCode2 size={15} />,
                      },
                      { value: "idea" as const, label: "Idea", icon: <FileText size={15} /> },
                    ] as const
                  ).map((opt) => {
                    const active = field.state.value === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          field.handleChange(opt.value);
                          if (mode === "create" && tab === "preview") setTab("write");
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-bold transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <span className={cn(active ? "text-primary" : "text-muted-foreground")}>
                          {opt.icon}
                        </span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </form.Field>

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
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={kind === "project" ? "near analytics" : "On-chain social graphs"}
                    className={err ? "!border-destructive" : ""}
                  />
                  {err && <ErrorText>{err}</ErrorText>}
                  {slugPreview !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      /{slugPreview || "my-entry"}
                    </p>
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
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={field.state.value ?? ""}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="A short summary shown in the list"
                    rows={3}
                    className={cn(
                      "resize-none",
                      err ? "border-destructive focus-visible:border-destructive" : "",
                    )}
                  />
                  {err && <ErrorText>{err}</ErrorText>}
                </div>
              );
            }}
          </form.Field>

          {kind === "project" && (
            <form.Field
              name="repository"
              validators={{
                onChangeListenTo: ["kind"],
                onChange: ({ value, fieldApi }: any) =>
                  validateRepository(value, fieldApi.form.getFieldValue("kind")),
                onSubmit: ({ value, fieldApi }: any) =>
                  validateRepository(value, fieldApi.form.getFieldValue("kind")),
              }}
            >
              {(field: any) => {
                const err = fieldError(field.state.meta.errors[0]);
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="repository">Repository URL</Label>
                    <Input
                      id="repository"
                      type="url"
                      value={field.state.value ?? ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className={cn("font-mono text-sm", err ? "!border-destructive" : "")}
                    />
                    {err && <ErrorText>{err}</ErrorText>}
                    <HelperText>README fetched from the default branch.</HelperText>
                  </div>
                );
              }}
            </form.Field>
          )}

          {mode === "edit" && (
            <form.Field name="status">
              {(field: any) => (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={field.state.value ?? "active"}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          )}

          <form.Field name="visibility">
            {(field: any) => (
              <div className="space-y-2">
                <Label>Visibility</Label>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      {
                        value: "public" as const,
                        label: "Public",
                        desc: isAdmin ? "Visible in the feed" : "Visible in the feed after review",
                      },
                      {
                        value: "unlisted" as const,
                        label: "Unlisted",
                        desc: "Only via direct link",
                      },
                      { value: "private" as const, label: "Private", desc: "Only you" },
                    ] as const
                  ).map((opt) => {
                    const active = field.state.value === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.handleChange(opt.value)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border-2 px-3 py-2.5 text-sm transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:bg-muted hover:border-border",
                        )}
                      >
                        <span className="font-bold text-foreground">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </form.Field>

          {kind === "idea" && (
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
                  <div className="space-y-1.5">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      value={field.state.value ?? ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="example.com"
                      className={cn("font-mono text-sm", err ? "!border-destructive" : "")}
                    />
                    {err && <ErrorText>{err}</ErrorText>}
                    <HelperText>Already have a domain to use?</HelperText>
                  </div>
                );
              }}
            </form.Field>
          )}

          {isAdmin && (
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
                  <div className="space-y-1.5">
                    <Label htmlFor="ownerId">Owner</Label>
                    <Input
                      id="ownerId"
                      value={field.state.value ?? ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={defaultOwnerId}
                      className={cn("font-mono text-sm", err ? "!border-destructive" : "")}
                    />
                    {err && <ErrorText>{err}</ErrorText>}
                    <HelperText>NEAR account that owns this entry. Defaults to you.</HelperText>
                  </div>
                );
              }}
            </form.Field>
          )}
        </div>
      </div>

      <div className="flex flex-col overflow-visible bg-muted lg:min-w-0 lg:flex-1 lg:overflow-hidden">
        {kind === "idea" ? (
          <form.Field
            name="content"
            validators={{
              onChangeListenTo: ["kind"],
              onChange: ({ value, fieldApi }: any) =>
                validateContent(value, fieldApi.form.getFieldValue("kind")),
              onSubmit: ({ value, fieldApi }: any) =>
                validateContent(value, fieldApi.form.getFieldValue("kind")),
            }}
          >
            {(field: any) => {
              const err = fieldError(field.state.meta.errors[0]);
              return (
                <>
                  <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="min-h-0 border-r border-border bg-card">
                      <ContentWriteTab
                        value={field.state.value ?? ""}
                        onChange={field.handleChange}
                        error={err}
                      />
                    </div>
                    <MarkdownPreviewPanel content={field.state.value ?? ""} />
                  </div>

                  <Tabs
                    value={tab}
                    onValueChange={(v) => setTab(v as "write" | "preview")}
                    className="flex flex-col overflow-visible gap-0 lg:hidden"
                  >
                    <div className="shrink-0 border-b border-border bg-card">
                      <TabsList className="h-auto px-3 flex justify-start gap-0 w-full bg-transparent border-none rounded-none">
                        {(["write", "preview"] as const).map((t) => (
                          <TabsTrigger
                            key={t}
                            value={t}
                            className="px-5 py-3.5 text-[13px] font-semibold rounded-none border-b-2 border-t-0 border-l-0 border-r-0 data-[state=active]:border-primary data-[state=inactive]:border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none -mb-px"
                          >
                            {t === "write" ? "Write" : "Preview"}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    <TabsContent value="write" className="m-0 overflow-visible">
                      <ContentWriteTab
                        value={field.state.value ?? ""}
                        onChange={field.handleChange}
                        error={err}
                      />
                    </TabsContent>

                    <TabsContent value="preview" className="m-0 overflow-visible">
                      <MarkdownPreviewPanel content={field.state.value ?? ""} compact />
                    </TabsContent>
                  </Tabs>
                </>
              );
            }}
          </form.Field>
        ) : (
          <div className="flex flex-col overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            {repositoryUrl.trim() ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3 sm:px-6">
                  <FileCode2 size={14} className="text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">README Preview</span>
                  {readmeQuery.isLoading && (
                    <span className="text-xs text-muted-foreground">Loading…</span>
                  )}
                </div>
                <div className="overflow-visible px-4 py-5 sm:px-8 sm:py-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                  {readmeQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading README…</p>
                  ) : readmeQuery.data ? (
                    <Markdown content={readmeQuery.data} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
                      No README available for this repository.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center sm:p-8">
                <FileCode2 size={40} className="text-border" />
                <p className="text-sm font-semibold text-foreground">Set a repository URL</p>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  The project detail page will fetch and render the README from the default branch.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ContentWriteTab({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
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
        placeholder={"# My Idea\n\nDescribe the concept, motivation, and next steps…"}
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
