import type { ApiClient } from "@/app";

export type EventRecord = Awaited<ReturnType<ApiClient["listEvents"]>>["data"][number];
export type LumaCalendar = Awaited<ReturnType<ApiClient["listLumaCalendars"]>>["data"][number];
export type LumaEvent = Awaited<ReturnType<ApiClient["listLumaEvents"]>>["data"][number];
export type EventTab = "upcoming" | "past";

export type InternalTimelineEvent = EventRecord & {
  key: string;
  source: "internal";
  sourceIds: string[];
};

export type LumaTimelineEvent = LumaEvent & {
  key: string;
  source: "luma";
  sourceIds: string[];
};

export type TimelineEvent = InternalTimelineEvent | LumaTimelineEvent;

export function calendarSourceId(calendarId: string) {
  return `calendar:${calendarId}`;
}

function canonicalEventUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hostname = hostname === "lu.ma" ? "luma.com" : hostname;
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return value.trim() || undefined;
  }
}

export function buildTimelineEvents(
  internalEvents: EventRecord[],
  lumaEvents: LumaEvent[],
  disabledSourceIds: Set<string>,
  tab: EventTab,
  timeBoundary: string,
) {
  const timeline: TimelineEvent[] = internalEvents.map((event) => ({
    ...event,
    key: `internal:${event.id}`,
    source: "internal",
    sourceIds: ["internal"],
  }));
  const byUrl = new Map<string, TimelineEvent>();
  for (const event of timeline) {
    const url = event.source === "internal" ? canonicalEventUrl(event.lumaUrl) : undefined;
    if (url) byUrl.set(url, event);
  }

  for (const event of lumaEvents) {
    const sourceId = calendarSourceId(event.calendarId);
    const url = canonicalEventUrl(event.url);
    const existing = url ? byUrl.get(url) : undefined;
    if (existing) {
      if (!existing.sourceIds.includes(sourceId)) existing.sourceIds.push(sourceId);
      if (existing.source === "luma" && event.access === "manage" && existing.access !== "manage") {
        existing.id = event.id;
        existing.calendarId = event.calendarId;
        existing.access = event.access;
      }
      continue;
    }

    const timelineEvent: LumaTimelineEvent = {
      ...event,
      key: `luma:${event.calendarId}:${event.id}`,
      source: "luma",
      sourceIds: [sourceId],
    };
    timeline.push(timelineEvent);
    if (url) byUrl.set(url, timelineEvent);
  }

  const direction = tab === "upcoming" ? 1 : -1;
  const boundary = new Date(timeBoundary).getTime();
  return timeline
    .filter((event) => {
      const end = new Date(event.endAt ?? event.startAt).getTime();
      return tab === "upcoming" ? end >= boundary : end < boundary;
    })
    .filter((event) => event.sourceIds.some((sourceId) => !disabledSourceIds.has(sourceId)))
    .sort(
      (left, right) =>
        direction * (new Date(left.startAt).getTime() - new Date(right.startAt).getTime()),
    );
}

export function formatEventTimeRange(event: Pick<TimelineEvent, "startAt" | "endAt">) {
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
