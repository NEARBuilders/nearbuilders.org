import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { customAlphabet } from "nanoid";
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
import { getEventFormErrorMessage, normalizeEventFormValues } from "./-event-form-utils";

type Visibility = "private" | "unlisted" | "public";

export const Route = createFileRoute("/_layout/events/new")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    if (!session?.user || session.user.isAnonymous) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  head: () => ({
    meta: [
      { title: "New Event | NEAR Builders" },
      { name: "description", content: "Submit a NEAR Builders event." },
    ],
  }),
  component: NewEventPage,
});

const slugId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

function generateSlug(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 93)
    .replace(/-+$/g, "");
  return `${base || "event"}-${slugId()}`;
}

function toDateTimeLocalValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function NewEventPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQueryOptions(auth, undefined));
  const nearAccountId = auth.near.getAccountId();
  const isAdmin = session?.user?.role === "admin";
  const defaultOwnerId =
    nearAccountId ??
    (session?.user as { walletAddress?: string | null } | undefined)?.walletAddress ??
    "";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [lumaUrl, setLumaUrl] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [startAt, setStartAt] = useState(toDateTimeLocalValue());
  const [endAt, setEndAt] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!defaultOwnerId && !isAdmin) {
        throw new Error("Link a NEAR account in settings before creating events.");
      }

      const submitForReview = visibility === "public" && !isAdmin;
      const normalized = normalizeEventFormValues({
        title,
        description,
        content,
        lumaUrl,
        location,
      });
      const event = await apiClient.createEvent({
        title: normalized.title,
        slug: generateSlug(normalized.title),
        description: normalized.description,
        content: normalized.content,
        lumaUrl: normalized.lumaUrl,
        startAt: toIso(startAt),
        endAt: endAt ? toIso(endAt) : undefined,
        location: normalized.location,
        visibility: submitForReview ? "private" : visibility,
      });

      if (submitForReview) {
        try {
          await apiClient.propose({
            pluginId: "events",
            entityId: event.id,
            payload: {
              title: event.title,
              slug: event.slug,
              description: event.description ?? undefined,
              content: event.content ?? undefined,
              visibility: "public",
              lumaUrl: event.lumaUrl ?? undefined,
              startAt: event.startAt,
              endAt: event.endAt ?? undefined,
              location: event.location ?? undefined,
              ownerId: event.ownerId,
            },
          });
        } catch (error) {
          console.error("Failed to submit event for review", error);
          return { event, submitForReview: false, reviewFailed: true };
        }
      }

      return { event, submitForReview, reviewFailed: false };
    },
    onSuccess: ({ event, submitForReview, reviewFailed }) => {
      toast.success(
        reviewFailed
          ? "Event created privately — review submission failed. Edit to resubmit."
          : submitForReview
            ? "Event submitted for review"
            : "Event created",
      );
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["admin-proposals", "events"] });
      void navigate({ to: "/events/$slug", params: { slug: event.slug } });
    },
    onError: (err: Error) => toast.error(getEventFormErrorMessage(err, "Failed to create event")),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
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
    createMutation.mutate();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2.5 sm:px-6 sm:py-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to events">
          <Link to="/events">
            <ArrowLeft size={15} />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">New Event</h1>
      </div>

      <form onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="lumaUrl">Luma URL</Label>
              <Input
                id="lumaUrl"
                type="url"
                value={lumaUrl}
                onChange={(e) => setLumaUrl(e.target.value)}
                placeholder="https://luma.com/..."
                maxLength={500}
              />
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

            <Button type="submit" disabled={createMutation.isPending} className="w-full">
              <CalendarDays size={14} />
              {createMutation.isPending ? "Creating..." : "Create event"}
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
