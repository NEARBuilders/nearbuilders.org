import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { ProjectFormLayout, type ProjectFormValues } from "@/components/project-form";
import { Button } from "@/components/ui/button";
import { parseProjectListSearch } from "./-search";

const STORAGE_KEY_PROJECT = "projects:new:project";
const STORAGE_KEY_IDEA = "projects:new:idea";

const loadDraft = (kind: "project" | "idea"): ProjectFormValues | null => {
  try {
    const raw = localStorage.getItem(kind === "project" ? STORAGE_KEY_PROJECT : STORAGE_KEY_IDEA);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectFormValues;
  } catch {
    return null;
  }
};

const saveDraft = (values: ProjectFormValues) => {
  try {
    const key = values.kind === "project" ? STORAGE_KEY_PROJECT : STORAGE_KEY_IDEA;
    localStorage.setItem(key, JSON.stringify(values));
  } catch {}
};

const clearDraft = (kind: "project" | "idea") => {
  try {
    localStorage.removeItem(kind === "project" ? STORAGE_KEY_PROJECT : STORAGE_KEY_IDEA);
  } catch {}
};

type SearchParams = ReturnType<typeof parseProjectListSearch> & {
  tab: "write" | "preview";
};

export const Route = createFileRoute("/_layout/_authenticated/_dashboard/projects/new")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    ...parseProjectListSearch(search),
    tab: search.tab === "preview" ? "preview" : "write",
  }),
  head: () => ({
    meta: [
      { title: "New | Projects" },
      { name: "description", content: "Create a new project or idea." },
    ],
  }),
  component: NewProjectPage,
});

const slugId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);
const proposalId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);
const slugSuffixRef: { current: string } = { current: "" };

const generateSlug = (v: string) => {
  const base = v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return "";
  if (!slugSuffixRef.current) slugSuffixRef.current = slugId();
  return `${base}-${slugSuffixRef.current}`;
};

function NewProjectPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const isAdmin = session?.user?.role === "admin";
  const canCreate = Boolean(session?.user && !session.user.isAnonymous);
  const search = Route.useSearch();
  const { tab } = search;
  const defaultOwnerId =
    nearAccountId ??
    (session?.user as { walletAddress?: string | null } | null)?.walletAddress ??
    session?.user?.id ??
    "";

  const setTab = (value: string) => {
    void navigate({
      search: (prev) => ({ ...prev, tab: value as "write" | "preview" }),
      replace: true,
    });
  };

  const initialDraft = {
    ...(loadDraft("project") ?? {
      kind: "project" as const,
      title: "",
      description: "",
      repository: "",
      content: "",
      visibility: "public" as const,
      ownerId: "",
      domain: "",
    }),
  } satisfies ProjectFormValues;

  const projectEntityIdRef = useRef(`proj_${proposalId()}`);

  const form = useForm({
    defaultValues: initialDraft as ProjectFormValues,
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value }) => {
      if (!canCreate) {
        toast.error("Link an identity in settings before publishing.");
        return;
      }
      await createMutation.mutateAsync(value);
    },
    onSubmitInvalid: () => {
      toast.error("Please fix the highlighted fields before creating your project.");
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: ProjectFormValues) =>
      apiClient.propose({
        pluginId: "projects",
        entityId: projectEntityIdRef.current,
        payload: {
          kind: values.kind,
          title: values.title.trim(),
          slug: generateSlug(values.title),
          description: values.description?.trim() || undefined,
          repository: values.repository?.trim() || undefined,
          content: values.content?.trim() || undefined,
          visibility: values.visibility,
          ownerId: values.ownerId?.trim() || defaultOwnerId || undefined,
          domain: values.domain?.trim() || undefined,
        },
      }),
    onSuccess: (_result, values) => {
      clearDraft(values.kind === "idea" ? "idea" : "project");
      toast.success(`${values.kind === "idea" ? "Idea" : "Project"} submitted for review`);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", "projects"] });
      navigate({
        to: "/projects",
        search: {
          kind: search.kind,
          personal: search.personal,
          private: search.private,
        },
      });
      projectEntityIdRef.current = `proj_${proposalId()}`;
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create"),
  });

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submitForm = useCallback(() => {
    void form.handleSubmit();
  }, [form]);

  const persist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      saveDraft(form.store.state.values);
    }, 300);
  }, [form]);

  useEffect(() => {
    const subscription = form.store.subscribe(() => {
      persist();
    });
    return () => {
      subscription.unsubscribe();
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [form, persist]);

  const title = useStore(form.store, (s) => s.values.title);
  const slugPreview = generateSlug(title) || undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to projects">
            <Link
              to="/projects"
              search={{
                preview: undefined,
                kind: search.kind,
                personal: search.personal,
                private: search.private,
              }}
            >
              <ArrowLeft size={15} />
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold text-foreground">New</span>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
          {!canCreate && (
            <span className="text-xs text-muted-foreground">
              Link an identity in settings to publish
            </span>
          )}
          <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting, kind: s.values.kind })}>
            {({ isSubmitting, kind }) => (
              <Button
                type="button"
                onClick={submitForm}
                disabled={!canCreate || isSubmitting || createMutation.isPending}
                size="sm"
              >
                {createMutation.isPending
                  ? "Submitting…"
                  : kind === "idea"
                    ? "Submit Idea"
                    : "Submit Project"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          submitForm();
        }}
        className="flex flex-1 overflow-y-auto lg:min-h-0 lg:overflow-hidden"
      >
        <ProjectFormLayout
          form={form}
          mode="create"
          isAdmin={isAdmin}
          defaultOwnerId={defaultOwnerId}
          tab={tab}
          setTab={setTab}
          slugPreview={slugPreview}
        />
      </form>
    </div>
  );
}
