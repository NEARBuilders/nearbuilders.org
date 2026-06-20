import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Input } from "@/components";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getEventFormErrorMessage,
  normalizeEventFormValues,
  normalizeLumaEventDetails,
} from "./-event-form-utils";

type Visibility = "private" | "unlisted" | "public";
type Status = "active" | "cancelled";

type EventRecord = Awaited<ReturnType<ReturnType<typeof useApiClient>["getEventBySlug"]>>["data"];

export const Route = createFileRoute("/_layout/events/$slug_/edit")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    if (!session?.user || session.user.isAnonymous) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  loader: async ({ params, context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    const viewerKey = session?.user?.id ?? "anonymous";

    await context.queryClient.prefetchQuery({
      queryKey: ["event", params.slug, viewerKey],
      queryFn: () => context.apiClient.getEventBySlug({ slug: params.slug }),
    });
  },
  head: () => ({
    meta: [
      { title: "Edit Event | NEAR Builders" },
      { name: "description", content: "Edit a NEAR Builders event." },
    ],
  }),
  component: EditEventPage,
});

function toDateTimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function EditEventPage() {
  const { slug } = Route.useParams();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const sessionWalletAddress = (session?.user as { walletAddress?: string | null } | undefined)
    ?.walletAddress;
  const viewerKey = session?.user?.id ?? "anonymous";

  const eventQuery = useQuery({
    queryKey: ["event", slug, viewerKey],
    queryFn: () => apiClient.getEventBySlug({ slug }),
    retry: false,
  });

  const event = eventQuery.data?.data;
  const canManage =
    event &&
    (session?.user?.role === "admin" ||
      [nearAccountId, sessionWalletAddress, session?.user?.id].some(
        (candidate) => candidate === event.ownerId,
      ));

  if (eventQuery.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-3">
          <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
        </div>
        <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
          <div className="h-9 w-full animate-pulse rounded bg-secondary" />
          <div className="h-24 w-full animate-pulse rounded bg-secondary" />
          <div className="h-9 w-1/2 animate-pulse rounded bg-secondary" />
        </div>
      </div>
    );
  }

  if (eventQuery.isError || !event) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 p-6">
        <p className="text-base font-semibold text-foreground">Event not found.</p>
        <Link to="/events" className="text-sm font-bold text-brand-accent hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 p-6">
        <p className="text-base font-semibold text-foreground">
          You don't have permission to edit this event.
        </p>
        <Link
          to="/events/$slug"
          params={{ slug }}
          className="text-sm font-bold text-brand-accent hover:underline"
        >
          Back to event
        </Link>
      </div>
    );
  }

  return <EditEventForm event={event} isAdmin={session?.user?.role === "admin"} />;
}

function EditEventForm({ event, isAdmin }: { event: EventRecord; isAdmin: boolean }) {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [content, setContent] = useState(event.content ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [lumaUrl, setLumaUrl] = useState(event.lumaUrl ?? "");
  const [visibility, setVisibility] = useState<Visibility>(event.visibility);
  const [status, setStatus] = useState<Status>(event.status);
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(new Date(event.startAt)));
  const [endAt, setEndAt] = useState(
    event.endAt ? toDateTimeLocalValue(new Date(event.endAt)) : "",
  );

  const lumaMutation = useMutation({
    mutationFn: async () => {
      if (!lumaUrl.trim()) {
        throw new Error("Luma URL is required");
      }
      return await apiClient.fetchLumaEvent({ url: lumaUrl.trim() });
    },
    onSuccess: ({ data }) => {
      const normalized = normalizeLumaEventDetails(data, lumaUrl);
      if (normalized.lumaUrl) setLumaUrl(normalized.lumaUrl);
      if (normalized.title) setTitle(normalized.title);
      if (normalized.description) setDescription(normalized.description);
      if (normalized.content && !content.trim()) setContent(normalized.content);
      if (normalized.location) setLocation(normalized.location);
      if (data.startAt) setStartAt(toDateTimeLocalValue(new Date(data.startAt)));
      if (data.endAt) setEndAt(toDateTimeLocalValue(new Date(data.endAt)));
      toast.success(
        normalized.wasTrimmed
          ? "Fetched Luma event details and shortened long fields"
          : "Fetched Luma event details",
      );
    },
    onError: (err: Error) =>
      toast.error(getEventFormErrorMessage(err, "Failed to fetch Luma event")),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const needsReview = !isAdmin && visibility === "public" && event.visibility !== "public";
      const normalized = normalizeEventFormValues({
        title,
        description,
        content,
        lumaUrl,
        location,
      });

      const updated = await apiClient.updateEvent({
        id: event.id,
        title: normalized.title,
        description: normalized.description,
        content: normalized.content,
        lumaUrl: normalized.lumaUrl,
        startAt: toIso(startAt),
        endAt: endAt ? toIso(endAt) : undefined,
        location: normalized.location,
        status,
        visibility: needsReview ? "private" : visibility,
      });

      if (needsReview) {
        await apiClient.propose({
          pluginId: "events",
          entityId: updated.id,
          payload: {
            title: updated.title,
            slug: updated.slug,
            description: updated.description ?? undefined,
            content: updated.content ?? undefined,
            visibility: "public",
            lumaUrl: updated.lumaUrl ?? undefined,
            startAt: updated.startAt,
            endAt: updated.endAt ?? undefined,
            location: updated.location ?? undefined,
            ownerId: updated.ownerId,
          },
        });
      }

      return { updated, needsReview };
    },
    onSuccess: ({ updated, needsReview }) => {
      toast.success(needsReview ? "Submitted for review" : "Event updated");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event", updated.slug] });
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", "events"] });
      void navigate({ to: "/events/$slug", params: { slug: updated.slug } });
    },
    onError: (err: Error) => toast.error(getEventFormErrorMessage(err, "Failed to update event")),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!startAt) {
      toast.error("Start date is required");
      return;
    }
    if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
      toast.error("End date must be after start date");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2.5 sm:px-6 sm:py-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to event">
          <Link to="/events/$slug" params={{ slug: event.slug }}>
            <ArrowLeft size={15} />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Edit Event</h1>
      </div>

      <form onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="lumaUrl">Luma URL</Label>
              <div className="flex gap-2">
                <Input
                  id="lumaUrl"
                  type="url"
                  value={lumaUrl}
                  onChange={(e) => setLumaUrl(e.target.value)}
                  placeholder="https://luma.com/..."
                  maxLength={500}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={lumaMutation.isPending}
                  onClick={() => lumaMutation.mutate()}
                >
                  <RefreshCw size={14} className={lumaMutation.isPending ? "animate-spin" : ""} />
                  Fetch
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="NEAR Builder Meetup"
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short summary for the events list."
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="startAt">Starts</Label>
                <Input
                  id="startAt"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endAt">Ends</Label>
                <Input
                  id="endAt"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  min={startAt}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Lisbon, Portugal or Online"
                maxLength={200}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <Select
                  value={visibility}
                  onValueChange={(value) => setVisibility(value as Visibility)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as Status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={updateMutation.isPending} className="w-full">
              <Save size={14} />
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">Details</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Agenda, speakers, registration notes, and anything attendees should know."
              rows={18}
              maxLength={50000}
              className="min-h-[340px]"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
