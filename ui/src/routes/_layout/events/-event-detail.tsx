import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Check, Clock, MapPin, Share2, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";

export type EventDetailData = {
  title: string;
  description: string | null;
  content: string | null;
  contentFormat?: "markdown" | "text";
  startAt: string;
  endAt: string | null;
  location: string | null;
  participantCount?: number;
  participantLabel?: string;
  coverUrl?: string | null;
  coverFit?: "cover" | "contain";
  locationType?: string | null;
};

export function EventDetail({
  event,
  breadcrumb,
  badges,
  notices,
  actions,
  primaryActions,
  host,
  after,
  copied,
  onShare,
}: {
  event: EventDetailData;
  breadcrumb: string;
  badges?: ReactNode;
  notices?: ReactNode;
  actions?: ReactNode;
  primaryActions?: ReactNode;
  host?: ReactNode;
  after?: ReactNode;
  copied: boolean;
  onShare: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to events">
            <Link to="/events">
              <ArrowLeft size={15} />
            </Link>
          </Button>
          <span className="hidden text-muted-foreground sm:inline">/</span>
          <span className="hidden max-w-[180px] truncate text-sm font-semibold text-foreground sm:block">
            {breadcrumb}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onShare}
            title="Copy link"
            className={copied ? "text-brand-accent" : ""}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
          </Button>
          {actions}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
        {notices}

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
            {event.title}
          </h1>
          {primaryActions}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Fact icon={<CalendarDays size={14} />} text={formatEventDate(event)} />
          <Fact icon={<Clock size={14} />} text={formatEventTime(event)} />
          {event.participantCount !== undefined && (
            <Fact
              icon={<Users size={14} />}
              text={`${event.participantCount} ${event.participantLabel ?? `participant${event.participantCount === 1 ? "" : "s"}`}`}
            />
          )}
        </div>

        {host}

        {event.coverUrl && (
          <img
            src={event.coverUrl}
            alt=""
            className={`mx-auto mt-6 block h-auto max-h-80 w-auto max-w-full rounded-xl border border-border bg-muted/30 sm:max-w-sm ${event.coverFit === "contain" ? "object-contain" : "object-cover"}`}
          />
        )}

        {(event.description || event.content) && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="text-lg font-bold text-foreground">About this event</h2>
            <div className="mt-3">
              <div className="space-y-4">
                {event.description && (
                  <p className="text-sm leading-relaxed text-foreground">{event.description}</p>
                )}
                {event.content && event.contentFormat === "markdown" ? (
                  <Markdown content={event.content} className="text-sm" />
                ) : event.content ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {event.content}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {after}

        {event.location && (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="text-lg font-bold text-foreground">Location</h2>
            <div className="mt-3 flex items-start gap-2 text-sm text-foreground">
              <MapPin size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
            {shouldShowLocationMap(event) && (
              <div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/30">
                <iframe
                  title={`Map of ${event.location}`}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                  className="h-72 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function shouldShowLocationMap(event: EventDetailData) {
  if (!event.location) return false;
  if (event.locationType) return event.locationType === "offline";
  return !/^(https?:\/\/|online\b|virtual\b|zoom\b|google meet\b|discord\b)/i.test(
    event.location.trim(),
  );
}

function Fact({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      {text}
    </span>
  );
}

export function formatEventDate(event: { startAt: string }) {
  return new Date(event.startAt).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEventTime(event: { startAt: string; endAt: string | null }) {
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
