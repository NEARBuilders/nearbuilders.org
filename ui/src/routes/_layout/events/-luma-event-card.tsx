import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Video } from "lucide-react";
import { formatEventTimeRange, type LumaTimelineEvent } from "./-event-sources";

export function LumaEventCard({ event }: { event: LumaTimelineEvent }) {
  const locationLabel = event.location
    ? event.location
    : event.locationType === "offline"
      ? "Location shared by host"
      : "Virtual";
  const isPhysical = Boolean(event.location) || event.locationType === "offline";
  const content = (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-foreground">
          {event.title}
        </span>
        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={12} className="shrink-0" />
          {formatEventTimeRange(event)}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {isPhysical ? (
            <MapPin size={12} className="shrink-0" />
          ) : (
            <Video size={12} className="shrink-0" />
          )}
          <span className="truncate">{locationLabel}</span>
        </div>
      </div>
      {event.coverUrl && (
        <img
          src={event.coverUrl}
          alt=""
          className="size-20 shrink-0 rounded-lg border border-border bg-muted/30 object-contain sm:size-24"
        />
      )}
    </div>
  );
  const className =
    "group block rounded-lg border border-border bg-card px-4 py-3.5 transition-all duration-200 hover:shadow-lg sm:px-5 sm:py-4";

  if (event.platform !== "luma" || event.access !== "manage") {
    return (
      <a href={event.url} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link
      to="/events/luma/$calendarId/$eventId"
      params={{ calendarId: event.calendarId, eventId: event.id }}
      className={className}
    >
      {content}
    </Link>
  );
}
