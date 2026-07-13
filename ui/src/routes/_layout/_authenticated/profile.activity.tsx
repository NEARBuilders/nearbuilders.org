import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { useApiClient, useAuthClient } from "@/app";
import { ActivityFeed } from "@/components/activity-feed";
import { parseSkills } from "@/components/builder-form";
import { CatalogClaimFlow } from "@/components/catalog-claim-flow";
import {
  ErrorText,
  fieldError,
  HelperText,
  validateOptionalMaxLength,
  validateTitle,
} from "@/components/project-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { activityFeedWithProfilesQueryOptions } from "@/lib/queries/activity";
import { catalogClaimProposalsQueryOptions } from "@/lib/queries/catalog";

type ActivitySubmission = {
  title: string;
  description: string;
  mediaUrl: string;
  tags: string;
};

type ActivityMode = "manual" | "claim";

type ActivitySearch = {
  mode?: ActivityMode;
};

export const Route = createFileRoute("/_layout/_authenticated/profile/activity")({
  validateSearch: (search: Record<string, unknown>): ActivitySearch => ({
    mode: search.mode === "manual" || search.mode === "claim" ? search.mode : undefined,
  }),
  loader: async ({ context }) => {
    const actor = context.authClient.near.getAccountId();
    if (!actor) return;
    await Promise.allSettled([
      context.queryClient.prefetchInfiniteQuery(
        activityFeedWithProfilesQueryOptions(
          context.apiClient,
          context.authClient,
          context.queryClient,
          { actor },
        ),
      ),
      context.queryClient.prefetchQuery({
        queryKey: ["my-builder-profile"],
        queryFn: () => context.apiClient.getMyBuilderProfile({}),
      }),
      context.queryClient.prefetchQuery(
        catalogClaimProposalsQueryOptions(context.apiClient, context.queryClient),
      ),
    ]);
  },
  head: () => ({
    meta: [
      { title: "My Activity | NEAR Builders" },
      { name: "description", content: "Track and submit your contributions." },
    ],
  }),
  component: ProfileActivityPage,
});

function ProfileActivityPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const nearAccountId = auth.near.getAccountId();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  const builderProfileQuery = useQuery({
    queryKey: ["my-builder-profile"],
    queryFn: () => apiClient.getMyBuilderProfile({}),
    enabled: Boolean(nearAccountId),
  });
  const isApprovedBuilder = Boolean(builderProfileQuery.data?.data);
  const mode: ActivityMode = search.mode === "manual" ? "manual" : "claim";
  const activeMode: ActivityMode = mode === "claim" && isApprovedBuilder ? "claim" : "manual";

  const emitMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiClient.emitActivity({
        source: "manual",
        type: "upload",
        payload,
      }),
    onSuccess: () => {
      toast.success("Activity submitted");
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to submit activity"),
  });

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      mediaUrl: "",
      tags: "",
    } satisfies ActivitySubmission,
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value, formApi }) => {
      const payload: Record<string, unknown> = { title: value.title.trim() };
      const description = value.description.trim();
      if (description) payload.description = description;
      const mediaUrl = value.mediaUrl.trim();
      if (mediaUrl) payload.mediaUrl = mediaUrl;
      const tags = parseSkills(value.tags);
      if (tags.length > 0) payload.tags = tags;
      await emitMutation.mutateAsync(payload);
      formApi.reset();
    },
    onSubmitInvalid: () => {
      toast.error("Please fix the highlighted fields before submitting.");
    },
  });

  const tags = parseSkills(useStore(form.store, (s) => s.values.tags ?? ""));
  const feedFilters = useMemo(() => ({ actor: nearAccountId ?? "" }), [nearAccountId]);

  if (!nearAccountId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h1 className="mb-2 text-2xl font-black text-foreground">Link a NEAR account</h1>
          <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Connect a NEAR account to track and submit your activity.
          </p>
          <Button asChild className="rounded-full px-6">
            <Link to="/settings">Open settings</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tight text-foreground mb-2">My activity</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Submit your contributions and track everything you've shared.
        </p>
      </div>

      <Tabs
        value={activeMode}
        onValueChange={(value) => {
          const nextMode = value as ActivityMode;
          void navigate({
            search: { mode: nextMode === "manual" ? "manual" : undefined },
            replace: true,
          });
        }}
        className="gap-6"
      >
        <TabsList aria-label="Activity submission mode">
          {isApprovedBuilder && <TabsTrigger value="claim">Project contribution</TabsTrigger>}
          <TabsTrigger value="manual">Manual activity</TabsTrigger>
        </TabsList>
        {isApprovedBuilder && (
          <TabsContent value="claim">
            <CatalogClaimFlow apiClient={apiClient} />
          </TabsContent>
        )}
        <TabsContent value="manual">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="mb-10 space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8"
          >
            <form.Field
              name="title"
              validators={{
                onChange: ({ value }) => validateTitle(value ?? ""),
                onSubmit: ({ value }) => validateTitle(value ?? ""),
              }}
            >
              {(field) => {
                const err = fieldError(field.state.meta.errors[0]);
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={field.state.value ?? ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="What did you ship?"
                      className={err ? "!border-destructive" : ""}
                    />
                    {err && <ErrorText>{err}</ErrorText>}
                  </div>
                );
              }}
            </form.Field>

            <form.Field
              name="description"
              validators={{
                onChange: ({ value }) =>
                  validateOptionalMaxLength(value, 1000, "Max 1000 characters"),
                onSubmit: ({ value }) =>
                  validateOptionalMaxLength(value, 1000, "Max 1000 characters"),
              }}
            >
              {(field) => {
                const err = fieldError(field.state.meta.errors[0]);
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={field.state.value ?? ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Add context about your contribution."
                      rows={4}
                      className={err ? "resize-none border-destructive" : "resize-none"}
                    />
                    {err && <ErrorText>{err}</ErrorText>}
                  </div>
                );
              }}
            </form.Field>

            <form.Field
              name="mediaUrl"
              validators={{
                onChange: ({ value }) =>
                  validateOptionalMaxLength(value, 500, "Max 500 characters"),
                onSubmit: ({ value }) =>
                  validateOptionalMaxLength(value, 500, "Max 500 characters"),
              }}
            >
              {(field) => {
                const err = fieldError(field.state.meta.errors[0]);
                const media = (field.state.value ?? "").trim();
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="mediaUrl">
                      Media URL{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="mediaUrl"
                      value={field.state.value ?? ""}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="https://… (video, image, or doc)"
                      className={err ? "!border-destructive" : ""}
                    />
                    {err && <ErrorText>{err}</ErrorText>}
                    {/^https?:\/\//i.test(media) && (
                      <img
                        key={media}
                        src={media}
                        alt="Media preview"
                        className="mt-1 size-24 rounded-md border border-border object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                  </div>
                );
              }}
            </form.Field>

            <form.Field name="tags">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="tags">
                    Tags{" "}
                    <span className="font-normal text-muted-foreground">(comma-separated)</span>
                  </Label>
                  <Input
                    id="tags"
                    value={field.state.value ?? ""}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="frontend, near, demo…"
                  />
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="rounded-full px-3 py-1 text-xs font-medium"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <HelperText>Add tags to categorize your contribution.</HelperText>
                  )}
                </div>
              )}
            </form.Field>

            <div className="border-t border-border pt-2">
              <form.Subscribe selector={(s) => ({ isSubmitting: s.isSubmitting })}>
                {({ isSubmitting }) => (
                  <Button
                    type="submit"
                    disabled={isSubmitting || emitMutation.isPending}
                    className="rounded-full px-6"
                  >
                    {emitMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                    {emitMutation.isPending ? "Submitting…" : "Submit activity"}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>

          <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">Recent activity</h2>
          <TooltipProvider>
            <ActivityFeed
              filters={feedFilters}
              emptyHint="Submit your first contribution using the form above."
            />
          </TooltipProvider>
        </TabsContent>
      </Tabs>
    </div>
  );
}
