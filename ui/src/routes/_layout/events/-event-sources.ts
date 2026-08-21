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

const EVENT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

function viewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function zoneNameFromParts(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locales?: Intl.LocalesArgument,
) {
  return (
    new Intl.DateTimeFormat(locales, { timeZone, ...options })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

function isOffsetZoneLabel(value: string) {
  return /^(GMT|UTC)([+-]|$)/i.test(value) || /^[+-]\d/.test(value);
}

function namedZoneFromLongLabel(date: Date, timeZone: string) {
  const longName = zoneNameFromParts(date, timeZone, { timeZoneName: "long" }, "en-US");
  if (!longName || isOffsetZoneLabel(longName) || /\d/.test(longName)) return "";
  const initials = longName.match(/\b[A-Z]/g);
  if (!initials || initials.length < 2 || initials.length > 5) return "";
  return initials.join("");
}

function formatLocalTime(date: Date, timeZone: string) {
  return date.toLocaleTimeString(undefined, { ...EVENT_TIME_OPTIONS, timeZone });
}

function formatLocalTimeZone(date: Date, timeZone: string) {
  for (const locale of [undefined, "en-IN", "en-GB", "en-US"] as const) {
    const shortName = zoneNameFromParts(date, timeZone, { timeZoneName: "short" }, locale);
    if (shortName && !isOffsetZoneLabel(shortName)) return shortName;
  }
  return (
    namedZoneFromLongLabel(date, timeZone) ||
    zoneNameFromParts(date, timeZone, { timeZoneName: "short" })
  );
}

export function formatEventTimeRange(event: Pick<TimelineEvent, "startAt" | "endAt">) {
  const timeZone = viewerTimeZone();
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const range = end
    ? `${formatLocalTime(start, timeZone)} - ${formatLocalTime(end, timeZone)}`
    : formatLocalTime(start, timeZone);
  const zone = formatLocalTimeZone(start, timeZone);
  return zone ? `${range} ${zone}` : range;
}
