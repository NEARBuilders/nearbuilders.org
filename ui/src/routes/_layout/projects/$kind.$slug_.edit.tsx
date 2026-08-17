import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { ProjectFormLayout, type ProjectFormValues } from "@/components/project-form";
import { Button } from "@/components/ui/button";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { isProjectKind, parseProjectListSearch } from "./-search";

function isCurrentUserOwner(
  ownerId: string | null | undefined,
  user:
    | { id?: string | null; walletAddress?: string | null; role?: string | null }
    | null
    | undefined,
  nearAccountId?: string | null,
) {
  if (!ownerId) return false;
  return [nearAccountId, user?.walletAddress, user?.id].some((candidate) => candidate === ownerId);
}

type SearchParams = ReturnType<typeof parseProjectListSearch> & {
  tab: "write" | "preview";
};

export const Route = createFileRoute("/_layout/projects/$kind/$slug_/edit")({
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
      { title: "Edit | Projects" },
      { name: "description", content: "Edit a project or idea." },
    ],
  }),
  component: EditProjectPage,
});

function EditProjectPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const search = Route.useSearch();
  const { tab } = search;

  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const isAdmin = session?.user?.role === "admin";

  const projectQuery = useQuery({
    queryKey: ["project", slug],
    queryFn: () => apiClient.getProjectBySlug({ slug }),
  });

  const project = projectQuery.data?.data;
  const projectId = project?.id;

  const defaultOwnerId =
    nearAccountId ??
    (session?.user as { walletAddress?: string | null } | null)?.walletAddress ??
    "";

  const canManage = isCurrentUserOwner(project?.ownerId, session?.user, nearAccountId);

  const updateMutation = useMutation({
    mutationFn: async (values: ProjectFormValues) => {
      const submitForReview =
        !isAdmin &&
        values.visibility === "public" &&
        project?.visibility !== "public" &&
        values.kind !== "result";
      const updated = await apiClient.updateProject({
        id: projectId!,
        kind: values.kind,
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        repository: values.kind === "project" ? values.repository?.trim() || undefined : undefined,
        content:
          values.kind === "idea" || values.kind === "scope" || values.kind === "result"
            ? values.content?.trim() || undefined
            : undefined,
        visibility: submitForReview ? undefined : values.visibility,
        status: values.kind !== "result" ? values.status : undefined,
        domain: values.domain?.trim() || undefined,
        ownerId:
          isAdmin && (values.ownerId?.trim() ?? "") !== (project?.ownerId ?? "")
            ? values.ownerId?.trim() || undefined
            : undefined,
      });
      if (submitForReview) {
        await apiClient.propose({
          pluginId: "projects",
          entityId: projectId!,
          payload: {
            kind: updated.kind,
            title: updated.title,
            slug: updated.slug,
            description: updated.description ?? undefined,
            repository: updated.repository ?? undefined,
            content: updated.content ?? undefined,
            visibility: "public",
            ownerId: updated.ownerId,
            domain: updated.domain ?? undefined,
          },
        });
      }
      return { submitForReview };
    },
    onSuccess: ({ submitForReview }: { submitForReview: boolean }) => {
      toast.success(submitForReview ? "Saved \u2014 submitted for review to go public" : "Saved");
      queryClient.invalidateQueries({ queryKey: ["project", slug] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-proposal", projectId] });
      navigate({
        to: "/projects/$kind/$slug",
        params: { kind: project!.kind, slug: project!.slug },
        search: {
          kind: search.kind,
          personal: search.personal,
          private: search.private,
          verified: search.verified,
        },
      });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteProject({ id: projectId! }),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({
        to: "/projects",
        search: {
          preview: undefined,
          kind: search.kind,
          personal: search.personal,
          private: search.private,
          verified: search.verified,
        },
      });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-6 py-3">
          <div className="h-5 w-30 rounded animate-pulse bg-secondary" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-8">
          <div className="h-8 w-[300px] rounded-md animate-pulse bg-secondary" />
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] flex-col items-center justify-center gap-4">
        <p className="text-base font-semibold text-foreground">Project not found.</p>
        <Link
          to="/projects"
          search={{
            preview: undefined,
            kind: search.kind,
            personal: search.personal,
            private: search.private,
            verified: search.verified,
          }}
          className="text-sm font-bold text-brand-accent hover:underline"
        >
          {"\u2190"} Back to projects
        </Link>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex min-h-[calc(100dvh-48px)] flex-col items-center justify-center gap-4">
        <p className="text-base font-semibold text-foreground">
          You don't have permission to edit this project.
        </p>
        <Link
          to="/projects/$kind/$slug"
          params={{ kind: project.kind, slug: project.slug }}
          search={{
            kind: search.kind,
            personal: search.personal,
            private: search.private,
            verified: search.verified,
          }}
          className="text-sm font-bold text-brand-accent hover:underline"
        >
          {"\u2190"} Back to project
        </Link>
      </div>
    );
  }

  return (
    <EditFormInner
      project={project}
      isAdmin={isAdmin}
      defaultOwnerId={defaultOwnerId}
      search={search}
      tab={tab}
      updateMutation={updateMutation}
      deleteMutation={deleteMutation}
    />
  );
}

function EditFormInner({
  project,
  isAdmin,
  defaultOwnerId,
  search,
  tab,
  updateMutation,
  deleteMutation,
}: {
  project: any;
  isAdmin: boolean;
  defaultOwnerId: string;
  search: SearchParams;
  tab: "write" | "preview";
  updateMutation: any;
  deleteMutation: any;
}) {
  const form = useForm({
    defaultValues: {
      kind: project.kind as "project" | "idea" | "scope" | "result",
      title: project.title ?? "",
      description: project.description ?? "",
      repository: project.repository ?? "",
      content: project.content ?? "",
      visibility: (project.visibility ?? "public") as "private" | "unlisted" | "public",
      status: (project.status ?? "active") as "active" | "paused" | "archived",
      ownerId: project.ownerId ?? "",
      domain: project.domain ?? "",
    } satisfies ProjectFormValues,
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value }) => {
      await updateMutation.mutateAsync(value);
    },
    onSubmitInvalid: () => {
      toast.error("Please fix the highlighted fields before saving.");
    },
  });

  const kindLabel = project.kind.charAt(0).toUpperCase() + project.kind.slice(1);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <PageBreadcrumb
              parentLabel="Projects"
              parentTo="/projects"
              parentSearch={{
                preview: undefined,
                kind: search.kind,
                personal: search.personal,
                private: search.private,
                verified: search.verified,
              }}
              current="Edit"
              currentClassName="text-sm font-semibold text-foreground"
            />
            <h1 className="mt-1 truncate text-lg font-semibold text-foreground sm:text-xl">
              Edit {kindLabel.toLowerCase()}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting })}>
              {({ isSubmitting }) => (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => form.handleSubmit()}
                  disabled={isSubmitting || updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Saving\u2026" : "Save changes"}
                </Button>
              )}
            </form.Subscribe>

            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm("Delete this project permanently?")) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Delete</span>
            </Button>

            <Button asChild size="sm" variant="outline">
              <Link
                to="/projects/$kind/$slug"
                params={{ kind: project.kind, slug: project.slug }}
                search={{
                  kind: search.kind,
                  personal: search.personal,
                  private: search.private,
                  verified: search.verified,
                }}
              >
                <X size={13} />
                <span className="hidden sm:inline">Cancel</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-1 flex-col"
      >
        <ProjectFormLayout
          form={form}
          mode="edit"
          isAdmin={isAdmin}
          defaultOwnerId={defaultOwnerId}
          tab={tab}
        />
      </form>
    </div>
  );
}
