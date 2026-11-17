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

export type EventTimeFormat = {
  timeZone: string;
  locale?: Intl.LocalesArgument;
};

export const UTC_EVENT_TIME_FORMAT: EventTimeFormat = {
  timeZone: "UTC",
  locale: "en-US",
};

export function viewerEventTimeFormat(): EventTimeFormat {
  return { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

const EVENT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

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

function namedZoneFromLongLabel(date: Date, timeZone: string, locale: string) {
  const longName = zoneNameFromParts(date, timeZone, { timeZoneName: "long" }, locale);
  if (!longName || isOffsetZoneLabel(longName) || /\d/.test(longName)) return "";
  const initials = longName.match(/\b[A-Z]/g);
  if (!initials || initials.length < 2 || initials.length > 5) return "";
  return initials.join("");
}

function formatLocalTime(date: Date, format: EventTimeFormat): string {
  return new Intl.DateTimeFormat(format.locale, {
    ...EVENT_TIME_OPTIONS,
    timeZone: format.timeZone,
  }).format(date);
}

function formatLocalTimeZone(date: Date, format: EventTimeFormat) {
  const zone = format.timeZone;
  if (!zone.includes("/") && /^(GMT|UTC)$/i.test(zone)) return zone.toUpperCase();
  for (const locale of [format.locale, "en-IN", "en-GB", "en-US"] as const) {
    const shortName = zoneNameFromParts(date, zone, { timeZoneName: "short" }, locale);
    if (shortName && !isOffsetZoneLabel(shortName)) return shortName;
  }
  return (
    namedZoneFromLongLabel(date, zone, "en-US") ||
    zoneNameFromParts(date, zone, { timeZoneName: "short" }, format.locale)
  );
}

export function formatEventTimeRange(
  event: Pick<TimelineEvent, "startAt" | "endAt">,
  format: EventTimeFormat,
) {
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const range = end
    ? `${formatLocalTime(start, format)} - ${formatLocalTime(end, format)}`
    : formatLocalTime(start, format);
  const zone = formatLocalTimeZone(start, format);
  return zone ? `${range} ${zone}` : range;
}

export function formatEventDate(event: { startAt: string }, format: EventTimeFormat) {
  return new Intl.DateTimeFormat(format.locale, {
    timeZone: format.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(event.startAt));
}

export type EventDayGroupData = {
  key: string;
  primaryLabel: string;
  secondaryLabel: string;
  events: TimelineEvent[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function zonedDayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function groupEventsByDay(
  events: TimelineEvent[],
  format: EventTimeFormat,
  nowISO: string,
): EventDayGroupData[] {
  const groups: EventDayGroupData[] = [];
  const index = new Map<string, EventDayGroupData>();
  const now = new Date(nowISO);
  const todayKey = zonedDayKey(now, format.timeZone);
  const tomorrowKey = zonedDayKey(new Date(now.getTime() + DAY_MS), format.timeZone);
  const dateLabel = new Intl.DateTimeFormat(format.locale, {
    timeZone: format.timeZone,
    month: "short",
    day: "numeric",
  });
  const weekdayLabel = new Intl.DateTimeFormat(format.locale, {
    timeZone: format.timeZone,
    weekday: "long",
  });
  for (const event of events) {
    const start = new Date(event.startAt);
    const key = zonedDayKey(start, format.timeZone);
    let group = index.get(key);
    if (!group) {
      group = {
        key,
        primaryLabel:
          key === todayKey ? "Today" : key === tomorrowKey ? "Tomorrow" : dateLabel.format(start),
        secondaryLabel: weekdayLabel.format(start),
        events: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}
