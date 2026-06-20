import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getSocialImageMeta } from "everything-dev/ui/metadata";
import type { Profile } from "better-near-auth";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_layout/events/$slug")({
  loader: async ({ params, context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    const viewerKey = session?.user?.id ?? "anonymous";
    const event = await context.queryClient
      .ensureQueryData({
        queryKey: ["event", params.slug, viewerKey],
        queryFn: () => context.apiClient.getEventBySlug({ slug: params.slug }),
      })
      .then((r) => r?.data ?? null)
      .catch(() => null);

    if (event) {
      await context.queryClient.prefetchQuery({
        queryKey: ["event-participants", event.id, viewerKey],
        queryFn: () => context.apiClient.listEventParticipants({ eventId: event.id }),
      });
    }

    if (session?.user && !session.user.isAnonymous && event) {
      await context.queryClient.prefetchQuery({
        queryKey: ["event-proposal", event.id, viewerKey],
        queryFn: () =>
          context.apiClient.getProposals({
            pluginId: "events",
            entityId: event.id,
            limit: 1,
          }),
      });
    }

    return { event, siteName: context.runtimeConfig?.runtime?.title ?? "NEAR Builders" };
  },
  head: ({ loaderData }) => {
    const event = loaderData?.event;
    const siteName = loaderData?.siteName ?? "NEAR Builders";
    const title = event ? `${event.title} | ${siteName}` : `Event | ${siteName}`;
    const description = event
      ? event.description?.trim() ||
        [formatEventDate(event), event.location].filter(Boolean).join(" · ")
      : "Event details on NEAR Builders.";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...getSocialImageMeta({
          imageUrl: "/metadata.png",
          title: event?.title ?? "Event",
          description,
          siteName,
          type: "article",
          alt: description,
        }),
      ],
    };
  },
  component: EventDetailPage,
});

function EventDetailPage() {
  const { slug } = Route.useParams();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
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
  const eventId = event?.id;
  const participantsQuery = useQuery({
    queryKey: ["event-participants", eventId, viewerKey],
    queryFn: () => apiClient.listEventParticipants({ eventId: eventId! }),
    enabled: Boolean(eventId),
    retry: false,
  });
  const participants = participantsQuery.data?.data ?? [];
  const currentParticipant = participants.find(
    (participant) =>
      participant.userId === session?.user?.id ||
      participant.walletAddress === sessionWalletAddress ||
      (nearAccountId
        ? participant.userId === nearAccountId || participant.walletAddress === nearAccountId
        : false),
  );
  const canManage =
    event &&
    (session?.user?.role === "admin" ||
      [nearAccountId, sessionWalletAddress, session?.user?.id].some(
        (candidate) => candidate === event.ownerId,
      ));
  const canParticipate = Boolean(
    session?.user && !session.user.isAnonymous && event?.status !== "cancelled",
  );
  const proposalQuery = useQuery({
    queryKey: ["event-proposal", eventId, viewerKey],
    queryFn: () =>
      apiClient.getProposals({
        pluginId: "events",
        entityId: eventId!,
        limit: 1,
      }),
    enabled: Boolean(canManage && eventId),
  });
  const eventProposal = proposalQuery.data?.data[0];

  const joinMutation = useMutation({
    mutationFn: () => apiClient.joinEvent({ eventId: eventId! }),
    onSuccess: () => {
      toast.success("You're participating");
      queryClient.invalidateQueries({ queryKey: ["event", slug] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event-participants", eventId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to join event"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiClient.leaveEvent({ eventId: eventId! }),
    onSuccess: () => {
      toast.success("Left event");
      queryClient.invalidateQueries({ queryKey: ["event", slug] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["event-participants", eventId] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to leave event"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteEvent({ id: eventId! }),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ["events"] });
      void navigate({ to: "/events" });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  const handleShare = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  if (eventQuery.isLoading) {
    return (
      <div className="flex flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="h-5 w-30 animate-pulse rounded bg-secondary" />
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
          <div className="h-9 w-2/3 animate-pulse rounded-md bg-secondary" />
          <div className="h-6 w-1/2 animate-pulse rounded bg-secondary" />
          <div className="mt-6 h-24 w-full animate-pulse rounded-xl bg-secondary" />
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

  const isCancelled = event.status === "cancelled";

  return (
    <div className="flex flex-col">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to events">
            <Link to="/events">
              <ArrowLeft size={15} />
            </Link>
          </Button>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="hidden max-w-[160px] truncate text-sm font-semibold text-foreground sm:block">
            {event.slug}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={handleShare}
            title="Copy link"
            className={copied ? "text-brand-accent" : ""}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
          </Button>
          {canManage && (
            <Button asChild size="sm" variant="outline">
              <Link to="/events/$slug/edit" params={{ slug: event.slug }}>
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            </Button>
          )}
          {canManage && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm("Delete this event permanently?")) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {event.visibility === "private" && <Lock size={11} />}
            {event.visibility}
          </Badge>
          {isCancelled && <Badge variant="destructive">Cancelled</Badge>}
          {canManage && eventProposal?.reviewStatus === "pending" && (
            <Badge variant="secondary">Pending admin review</Badge>
          )}
          {canManage && eventProposal?.reviewStatus === "rejected" && (
            <Badge variant="destructive">Rejected by admin</Badge>
          )}
        </div>

        {canManage && eventProposal?.reviewStatus === "pending" && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            This event is private while it waits for admin approval to become public.
          </div>
        )}

        {canManage && eventProposal?.reviewStatus === "rejected" && (
          <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-destructive">
              <X size={14} />
              Rejected by admin
            </div>
            <p className="mt-1 text-muted-foreground">
              {eventProposal.rejectionReason ?? "This event was not approved."}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
            {event.title}
          </h1>
          {(event.lumaUrl || canParticipate) && (
            <div className="flex w-full shrink-0 flex-col items-center gap-2 sm:w-auto">
              {event.lumaUrl && (
                <Button asChild size="sm" className="w-full sm:w-auto">
                  <a href={event.lumaUrl} target="_blank" rel="noopener noreferrer">
                    {isCancelled ? "View on Luma" : "Register on Luma"}
                    <ExternalLink size={13} />
                  </a>
                </Button>
              )}
              {canParticipate && (
                <Button
                  type="button"
                  size="sm"
                  variant={currentParticipant ? "outline" : "default"}
                  className="w-full sm:w-auto"
                  disabled={joinMutation.isPending || leaveMutation.isPending}
                  onClick={() => {
                    if (currentParticipant) leaveMutation.mutate();
                    else joinMutation.mutate();
                  }}
                >
                  {joinMutation.isPending || leaveMutation.isPending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Users size={13} />
                  )}
                  {currentParticipant ? "Leave event" : "Join event"}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Fact icon={<CalendarDays size={14} />} text={formatEventDate(event)} />
          <Fact icon={<Clock size={14} />} text={formatEventTime(event)} />
          <Fact
            icon={<Users size={14} />}
            text={`${event.participantCount} participant${event.participantCount === 1 ? "" : "s"}`}
          />
          {event.location && <Fact icon={<MapPin size={14} />} text={event.location} />}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          Hosted by{" "}
          {getProfileAccountId(event.ownerId) ? (
            <Link
              to="/builders/$account"
              params={{ account: event.ownerId }}
              className="font-medium text-foreground hover:underline"
            >
              {shortenId(event.ownerId)}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{shortenId(event.ownerId)}</span>
          )}
        </p>

        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-lg font-bold text-foreground">About this event</h2>
          <div className="mt-3">
            {event.description || event.content ? (
              <div className="space-y-4">
                {event.description && (
                  <p className="text-sm leading-relaxed text-foreground">{event.description}</p>
                )}
                {event.content && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {event.content}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                No additional details yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-lg font-bold text-foreground">Participants</h2>
          <div className="mt-3">
            {participantsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading participants...</p>
            ) : participants.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {participants.map((participant) => (
                  <ParticipantBadge key={participant.id} participant={participant} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
                No participants yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      {text}
    </span>
  );
}

function shortenId(id: string): string {
  // Named accounts (e.g. itexpert120.near) are shown in full; only implicit
  // 64-char hex accounts get truncated since they're not human-readable.
  if (/^[0-9a-f]{64}$/i.test(id)) return `${id.slice(0, 6)}...${id.slice(-4)}`;
  return id;
}

type EventParticipantRecord = Awaited<
  ReturnType<ReturnType<typeof useApiClient>["listEventParticipants"]>
>["data"][number];

function ParticipantBadge({ participant }: { participant: EventParticipantRecord }) {
  const auth = useAuthClient();
  const accountId = getParticipantAccountId(participant);
  const { data: profile } = useQuery<Profile | null>({
    queryKey: ["near-profile", accountId],
    queryFn: async () => {
      const res = await auth.near.getProfile(accountId ?? undefined);
      return res.data || null;
    },
    enabled: !!accountId,
  });
  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);
  const label = formatParticipantLabel(participant);
  const className =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary";
  const content = (
    <>
      <Avatar className="size-5">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={`${label} avatar`} />}
        <AvatarFallback className="text-[10px]">
          {accountId ? label.slice(0, 1).toUpperCase() : <Users size={11} />}
        </AvatarFallback>
      </Avatar>
      {label}
    </>
  );

  if (!accountId) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link to="/builders/$account" params={{ account: accountId }} className={className}>
      {content}
    </Link>
  );
}

function getParticipantAccountId(participant: EventParticipantRecord) {
  return participant.walletAddress ?? getProfileAccountId(participant.userId);
}

function getProfileAccountId(id: string) {
  if (id.includes(".") || /^[0-9a-f]{64}$/i.test(id)) return id;
  return null;
}

function formatParticipantLabel(participant: EventParticipantRecord) {
  return participant.displayName ?? participant.walletAddress ?? shortenId(participant.userId);
}

function formatEventDate(event: { startAt: string }) {
  return new Date(event.startAt).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(event: { startAt: string; endAt: string | null }) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!end) return startLabel;
  return `${startLabel} - ${end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}
