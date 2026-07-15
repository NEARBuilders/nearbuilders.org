import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { customAlphabet } from "nanoid";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { ProjectFormLayout, type ProjectFormValues } from "@/components/project-form";
import { Button } from "@/components/ui/button";
import { clearDraft, getDraft, type ProjectKind, setDraft } from "@/lib/draft-store";
import { isProjectKind, parseProjectListSearch } from "./-search";

const LAST_KIND_KEY = "projects:last-kind";

const defaultValuesForKind = (kind: ProjectKind): ProjectFormValues => ({
  kind,
  title: "",
  description: "",
  repository: "",
  content: "",
  visibility: "public" as const,
  ownerId: "",
  domain: "",
});

type SearchParams = ReturnType<typeof parseProjectListSearch> & {
  tab: "write" | "preview";
};

export const Route = createFileRoute("/_layout/projects/new/$kind")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    ...parseProjectListSearch(search),
    tab: search.tab === "preview" ? "preview" : "write",
  }),
  beforeLoad: async ({ params, context, location }) => {
    if (!isProjectKind(params.kind)) throw redirect({ to: "/projects" });
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    if (!session?.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  head: () => ({
    meta: [
      { title: "New | Projects" },
      { name: "description", content: "Create a new project or idea." },
    ],
  }),
  component: () => {
    const { kind } = Route.useParams();
    return <NewProjectPage key={kind} />;
  },
});

function NewProjectPage() {
  const { kind: routeKind } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const isAdmin = session?.user?.role === "admin";
  const search = Route.useSearch();
  const { tab } = search;
  const defaultOwnerId =
    nearAccountId ??
    (session?.user as { walletAddress?: string | null } | null)?.walletAddress ??
    "";
  const canCreate = Boolean(
    session?.user && !session.user.isAnonymous && (defaultOwnerId || isAdmin),
  );

  const slugId = useMemo(() => customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6), []);
  const slugSuffixRef = useRef("");
  const generateSlug = useCallback(
    (v: string) => {
      const base = v
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!base) return "";
      if (!slugSuffixRef.current) slugSuffixRef.current = slugId();
      return `${base}-${slugSuffixRef.current}`;
    },
    [slugId],
  );

  const draft = getDraft(routeKind as ProjectKind);
  const initialDraft = (draft ??
    defaultValuesForKind(routeKind as ProjectKind)) satisfies ProjectFormValues;

  const form = useForm({
    defaultValues: initialDraft as ProjectFormValues,
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value }) => {
      if (!canCreate) {
        toast.error("Link a NEAR account in settings before creating projects.");
        return;
      }
      await createMutation.mutateAsync(value);
    },
    onSubmitInvalid: () => {
      toast.error("Please fix the highlighted fields before creating your project.");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const submitForReview = values.visibility === "public" && !isAdmin && routeKind !== "result";
      const project = await apiClient.createProject({
        kind: routeKind as ProjectKind,
        title: values.title.trim(),
        slug: generateSlug(values.title),
        description: values.description?.trim() || undefined,
        repository: values.repository?.trim() || undefined,
        content: values.content?.trim() || undefined,
        visibility: submitForReview ? "private" : values.visibility,
        ownerId: isAdmin ? values.ownerId?.trim() || defaultOwnerId || undefined : undefined,
        domain: values.domain?.trim() || undefined,
      });
      if (submitForReview) {
        await apiClient.propose({
          pluginId: "projects",
          entityId: project.id,
          payload: {
            kind: project.kind,
            title: project.title,
            slug: project.slug,
            description: project.description ?? undefined,
            repository: project.repository ?? undefined,
            content: project.content ?? undefined,
            visibility: "public",
            ownerId: project.ownerId,
            domain: project.domain ?? undefined,
          },
        });
      }
      return { project, submitForReview };
    },
    onSuccess: ({ project, submitForReview }, _values) => {
      clearDraft(routeKind as ProjectKind);
      const kindLabels: Record<ProjectKind, string> = {
        project: "Project",
        idea: "Idea",
        scope: "Scope",
        result: "Result",
      };
      const label = kindLabels[routeKind as ProjectKind];
      toast.success(
        submitForReview
          ? `${label} created \u2014 submitted for review to go public`
          : `${label} created`,
      );
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-proposal", project.id] });
      navigate({
        to: "/projects/$kind/$slug",
        params: { kind: project.kind, slug: project.slug },
        search: {
          personal: search.personal,
          private: search.private,
        },
      });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create"),
  });

  const submitForm = useCallback(() => {
    void form.handleSubmit();
  }, [form]);

  useEffect(() => {
    const subscription = form.store.subscribe(() => {
      setDraft(routeKind as ProjectKind, form.store.state.values);
    });
    return () => subscription.unsubscribe();
  }, [form, routeKind]);

  const title = useStore(form.store, (s) => s.values.title);
  const slugPreview = generateSlug(title) || undefined;

  useEffect(() => {
    try {
      localStorage.setItem(LAST_KIND_KEY, routeKind);
    } catch {}
  }, [routeKind]);

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
              Link a NEAR account in settings to create projects
            </span>
          )}
          <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting })}>
            {({ isSubmitting }) => (
              <Button
                type="button"
                onClick={submitForm}
                disabled={!canCreate || isSubmitting || createMutation.isPending}
                size="sm"
              >
                {createMutation.isPending
                  ? "Creating\u2026"
                  : routeKind === "idea"
                    ? "Create Idea"
                    : routeKind === "scope"
                      ? "Create Scope"
                      : routeKind === "result"
                        ? "Post Result"
                        : "Create Project"}
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
          slugPreview={slugPreview}
          currentKind={routeKind}
        />
      </form>
    </div>
  );
}
