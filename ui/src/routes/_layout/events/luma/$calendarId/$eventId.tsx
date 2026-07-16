import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getSocialImageMeta } from "everything-dev/ui/metadata";
import { ExternalLink } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAssetUrl, getSiteUrl } from "@/lib/site-url";
import { EventDetail, formatEventDate } from "../../-event-detail";

const LUMA_EVENT_STALE_TIME_MS = 2 * 60 * 1000;

export const Route = createFileRoute("/_layout/events/luma/$calendarId/$eventId")({
  loader: async ({ params, context }) => {
    const event = await context.queryClient
      .ensureQueryData({
        queryKey: ["luma-event", params.calendarId, params.eventId],
        queryFn: () => context.apiClient.getLumaEvent(params),
      })
      .then((result) => result.data)
      .catch(() => null);
    return {
      event,
      siteName: context.runtimeConfig?.runtime?.title ?? "NEAR Builders",
      siteUrl: getSiteUrl(
        context.runtimeConfig,
        `/events/luma/${params.calendarId}/${params.eventId}`,
      ),
      imageUrl: event?.coverUrl ?? getAssetUrl(context.runtimeConfig, "/metadata.png"),
    };
  },
  head: ({ loaderData }) => {
    const event = loaderData?.event;
    const siteName = loaderData?.siteName ?? "NEAR Builders";
    const description = event
      ? event.description?.trim() ||
        [formatEventDate(event), event.location].filter(Boolean).join(" · ")
      : "Event details on NEAR Builders.";
    return {
      meta: [
        { title: event ? `${event.title} | ${siteName}` : `Event | ${siteName}` },
        { name: "description", content: description },
        ...getSocialImageMeta({
          imageUrl: loaderData?.imageUrl ?? "/metadata.png",
          title: event?.title ?? "Event",
          description,
          siteName,
          siteUrl: loaderData?.siteUrl,
          type: "article",
          alt: description,
        }),
      ],
    };
  },
  component: LumaEventDetailPage,
});

function LumaEventDetailPage() {
  const params = Route.useParams();
  const apiClient = useApiClient();
  const [copied, setCopied] = useState(false);
  const eventQuery = useQuery({
    queryKey: ["luma-event", params.calendarId, params.eventId],
    queryFn: () => apiClient.getLumaEvent(params),
    retry: false,
    staleTime: LUMA_EVENT_STALE_TIME_MS,
  });
  const event = eventQuery.data?.data;
  const handleShare = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  if (eventQuery.isLoading) {
    return <EventDetailSkeleton />;
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

  return (
    <EventDetail
      event={{
        ...event,
        description: event.descriptionMarkdown ? null : event.description,
        content: event.descriptionMarkdown,
        contentFormat: "markdown",
        coverFit: "contain",
        participantCount: event.guestCount,
        participantLabel: event.guestCount === 1 ? "guest" : "guests",
      }}
      breadcrumb={event.title}
      copied={copied}
      onShare={handleShare}
      badges={
        <>
          <Badge variant="secondary" className="capitalize">
            {event.visibility}
          </Badge>
          {!event.registrationOpen && <Badge variant="secondary">Registration closed</Badge>}
          {event.spotsRemaining !== null && (
            <Badge variant="secondary">{event.spotsRemaining} spots left</Badge>
          )}
          {event.requireApproval && <Badge variant="secondary">Approval required</Badge>}
          {event.waitlistEnabled && <Badge variant="secondary">Waitlist available</Badge>}
          {event.displayPrice && (
            <Badge variant="secondary">{formatDisplayPrice(event.displayPrice)}</Badge>
          )}
        </>
      }
      primaryActions={
        <Button asChild size="sm" className="w-full sm:w-auto">
          <a href={event.url} target="_blank" rel="noopener noreferrer">
            {event.registrationOpen ? "Register on Luma" : "View on Luma"}
            <ExternalLink size={13} />
          </a>
        </Button>
      }
      host={
        event.hosts.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Hosted by</span>
            {event.hosts.map((host) => (
              <span
                key={host.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-sm font-medium text-foreground"
              >
                <Avatar className="size-6">
                  {host.avatarUrl && <AvatarImage src={host.avatarUrl} alt="" />}
                  <AvatarFallback className="text-[10px]">{getInitials(host.name)}</AvatarFallback>
                </Avatar>
                {host.name}
              </span>
            ))}
          </div>
        ) : null
      }
    />
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDisplayPrice(price: { amount: number; currency: string; isFlexible: boolean }) {
  const currency = price.currency.toUpperCase();
  let label: string;
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    label = formatter.format(price.amount / 10 ** digits);
  } catch {
    label = `${price.amount} ${currency.replace("SOLANA_", "")}`;
  }
  return price.isFlexible ? `${label}+` : label;
}

function EventDetailSkeleton() {
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
