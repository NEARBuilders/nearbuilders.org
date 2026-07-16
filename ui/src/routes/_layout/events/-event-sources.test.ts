import { describe, expect, it } from "vitest";
import {
  buildTimelineEvents,
  calendarSourceId,
  type EventRecord,
  type LumaEvent,
} from "./-event-sources";

const internalEvent: EventRecord = {
  id: "internal-1",
  ownerId: "alice.near",
  slug: "builders-meetup",
  title: "Builders Meetup",
  description: null,
  content: null,
  status: "active",
  visibility: "public",
  lumaUrl: "https://lu.ma/builders-meetup/",
  startAt: "2026-08-01T12:00:00.000Z",
  endAt: "2026-08-01T13:00:00.000Z",
  location: null,
  participantCount: 2,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function lumaEvent(
  calendarId: string,
  id: string,
  url: string,
  access: LumaEvent["access"] = "manage",
): LumaEvent {
  return {
    id,
    calendarId,
    platform: "luma",
    title: "Builders Meetup",
    url,
    coverUrl: null,
    startAt: "2026-08-01T12:00:00.000Z",
    endAt: "2026-08-01T13:00:00.000Z",
    timezone: "UTC",
    location: null,
    locationType: null,
    visibility: "public",
    access,
  };
}

describe("event source normalization", () => {
  it("deduplicates matching local and Luma events while retaining filter sources", () => {
    const timeline = buildTimelineEvents(
      [internalEvent],
      [lumaEvent("cal-a", "luma-1", "https://luma.com/builders-meetup?utm_source=test")],
      new Set(),
      "upcoming",
      "2026-07-16T00:00:00.000Z",
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      source: "internal",
      sourceIds: ["internal", calendarSourceId("cal-a")],
    });
  });

  it("keeps a merged event visible through either enabled calendar source", () => {
    const timeline = buildTimelineEvents(
      [internalEvent],
      [lumaEvent("cal-a", "luma-1", "https://lu.ma/builders-meetup")],
      new Set(["internal"]),
      "upcoming",
      "2026-07-16T00:00:00.000Z",
    );
    expect(timeline).toHaveLength(1);

    const hidden = buildTimelineEvents(
      [internalEvent],
      [lumaEvent("cal-a", "luma-1", "https://lu.ma/builders-meetup")],
      new Set(["internal", calendarSourceId("cal-a")]),
      "upcoming",
      "2026-07-16T00:00:00.000Z",
    );
    expect(hidden).toEqual([]);
  });

  it("deduplicates one event listed by multiple Luma calendars", () => {
    const timeline = buildTimelineEvents(
      [],
      [
        lumaEvent("cal-a", "luma-1", "https://lu.ma/shared"),
        lumaEvent("cal-b", "luma-1", "https://lu.ma/shared/"),
      ],
      new Set(),
      "upcoming",
      "2026-07-16T00:00:00.000Z",
    );
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.sourceIds).toEqual([calendarSourceId("cal-a"), calendarSourceId("cal-b")]);
  });

  it("prefers a managed calendar copy when a viewed event is listed more than once", () => {
    const timeline = buildTimelineEvents(
      [],
      [
        lumaEvent("cal-view", "view-id", "https://lu.ma/shared", "view"),
        lumaEvent("cal-manage", "manage-id", "https://lu.ma/shared", "manage"),
      ],
      new Set(),
      "upcoming",
      "2026-07-16T00:00:00.000Z",
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      id: "manage-id",
      calendarId: "cal-manage",
      access: "manage",
    });
  });

  it("keeps an event upcoming until its end time", () => {
    const ongoing = lumaEvent("cal-a", "ongoing", "https://lu.ma/ongoing");
    ongoing.startAt = "2026-07-15T23:00:00.000Z";
    ongoing.endAt = "2026-07-16T01:00:00.000Z";

    const timeline = buildTimelineEvents(
      [],
      [ongoing],
      new Set(),
      "upcoming",
      "2026-07-16T00:00:00.000Z",
    );

    expect(timeline).toHaveLength(1);
  });
});
