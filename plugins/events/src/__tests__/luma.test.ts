import { describe, expect, it, vi } from "vitest";
import { LumaService, parseLumaApiKeys } from "../services/luma";

const calendars = {
  "key-a": {
    id: "cal-a",
    name: "Alpha Calendar",
    slug: "alpha",
    url: "https://lu.ma/alpha",
    avatar_url: null,
    cover_image_url: null,
    description: "Alpha events",
    location: { timezone: "UTC" },
  },
  "key-b": {
    id: "cal-b",
    name: "Beta Calendar",
    slug: "beta",
    url: "https://lu.ma/beta",
    avatar_url: null,
    cover_image_url: null,
    description: null,
    location: null,
  },
};

function createFetch() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const apiKey = new Headers(init?.headers).get("x-luma-api-key") ?? "";
    const calendar = calendars[apiKey as keyof typeof calendars];

    if (url.pathname === "/v1/calendars/get") {
      return calendar
        ? Response.json(calendar)
        : Response.json({ error: "unauthorized" }, { status: 401 });
    }

    if (url.pathname === "/v1/calendars/events/list" && calendar) {
      const cursor = url.searchParams.get("pagination_cursor");
      const suffix = cursor ? "next" : "first";
      return Response.json({
        entries: [
          {
            platform: "luma",
            id: `evt-${calendar.id}-${suffix}`,
            calendar_id: calendar.id,
            name: `${calendar.name} ${suffix}`,
            url: `https://lu.ma/${calendar.id}-${suffix}`,
            cover_url: null,
            start_at: cursor ? "2026-08-02T12:00:00.000Z" : "2026-08-01T12:00:00.000Z",
            end_at: cursor ? "2026-08-02T13:00:00.000Z" : "2026-08-01T13:00:00.000Z",
            timezone: "UTC",
            geo_address_json: { full_address: "1 Main Street" },
            location_type: "offline",
            location_visibility: "public",
            visibility: "public",
            access: "manage",
          },
        ],
        has_more: apiKey === "key-a" && !cursor,
        next_cursor: apiKey === "key-a" && !cursor ? "alpha-next" : undefined,
      });
    }

    if (url.pathname === "/v1/events/get" && calendar) {
      const eventId = url.searchParams.get("event_id");
      return Response.json({
        platform: "luma",
        id: eventId,
        calendar_id: calendar.id,
        name: `${calendar.name} details`,
        url: `https://lu.ma/${eventId}`,
        cover_url: "https://images.example.com/event.png",
        start_at: "2026-08-01T12:00:00.000Z",
        end_at: "2026-08-01T13:00:00.000Z",
        timezone: "UTC",
        geo_address_json: { full_address: "1 Main Street" },
        location_type: "offline",
        location_visibility: eventId === "evt-private-location" ? "guests-only" : "public",
        meeting_url: "https://meet.example.com/private",
        visibility: eventId === "evt-private" ? "private" : "public",
        description: "Event summary",
        description_md: "## Event details",
        hosts: [
          { id: "usr-alice", name: "Alice", avatar_url: "https://images.example.com/alice.png" },
          { id: "usr-bob", name: "Bob", avatar_url: "" },
        ],
        guest_counts: {
          approved: { guests: 42, tickets: 42 },
          pending_approval: { guests: 2, tickets: 2 },
          waitlist: { guests: 3, tickets: 3 },
          invited: { guests: 4, tickets: 0 },
          declined: { guests: 1, tickets: 0 },
          checked_in: { guests: 12, tickets: 12 },
        },
        registration_open: true,
        spots_remaining: 8,
        require_approval: true,
        waitlist_status: "enabled",
        display_price: { amount: 1500, currency: "usd", is_flexible: false },
      });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  });
}

describe("LumaService", () => {
  it("parses, trims, and deduplicates configured API keys", () => {
    expect(parseLumaApiKeys('[" key-a ", "key-b", "key-a", ""]')).toEqual(["key-a", "key-b"]);
    expect(() => parseLumaApiKeys("key-a,key-b")).toThrow(
      "LUMA_CALENDAR_API_KEYS must be a JSON array of strings",
    );
  });

  it("loads calendar metadata independently and caches the registry", async () => {
    const fetchImplementation = createFetch();
    const service = new LumaService(
      ["key-a", "invalid-key", "key-b"],
      fetchImplementation as unknown as typeof fetch,
    );

    const first = await service.listCalendars();
    const second = await service.listCalendars();

    expect(first).toEqual({
      data: [
        expect.objectContaining({ id: "cal-a", name: "Alpha Calendar", timezone: "UTC" }),
        expect.objectContaining({ id: "cal-b", name: "Beta Calendar", timezone: null }),
      ],
      unavailableCount: 1,
    });
    expect(second).toEqual(first);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(first)).not.toContain("key-a");
  });

  it("aggregates independently paginated event feeds and caches pages", async () => {
    const fetchImplementation = createFetch();
    const service = new LumaService(
      ["key-a", "key-b"],
      fetchImplementation as unknown as typeof fetch,
    );

    const [first, concurrent] = await Promise.all([
      service.listEvents({ after: "2026-08-01T00:00:00.000Z" }),
      service.listEvents({ after: "2026-08-01T00:00:00.000Z" }),
    ]);
    const cached = await service.listEvents({ after: "2026-08-01T00:00:00.000Z" });
    const refreshed = await service.listEvents({ after: "2026-08-01T00:00:30.000Z" });

    expect(first.data).toHaveLength(2);
    expect(first.data[0]?.access).toBe("manage");
    expect(first.meta.hasMore).toBe(true);
    expect(first.meta.nextCursor).toBeTruthy();
    expect(concurrent).toEqual(first);
    expect(cached).toEqual(first);
    expect(refreshed).toEqual(first);
    expect(fetchImplementation).toHaveBeenCalledTimes(4);

    const eventRequest = fetchImplementation.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.pathname === "/v1/calendars/events/list");
    expect(eventRequest?.searchParams.getAll("platforms")).toEqual(["luma", "external"]);
    expect(eventRequest?.searchParams.getAll("access")).toEqual(["manage", "view"]);

    const second = await service.listEvents({
      after: "2026-08-01T00:00:00.000Z",
      cursor: first.meta.nextCursor ?? undefined,
    });
    expect(second.data.map((event) => event.id)).toEqual(["evt-cal-a-next"]);
    expect(second.meta).toEqual({ hasMore: false, nextCursor: null });
    expect(fetchImplementation).toHaveBeenCalledTimes(5);
  });

  it("rejects malformed pagination cursors", async () => {
    const service = new LumaService(["key-a"], createFetch() as unknown as typeof fetch);
    await expect(service.listEvents({ cursor: "not-a-cursor" })).rejects.toThrow(
      "Invalid Luma pagination cursor",
    );
  });

  it("fetches event details with the key belonging to its calendar", async () => {
    const fetchImplementation = createFetch();
    const service = new LumaService(
      ["key-a", "key-b"],
      fetchImplementation as unknown as typeof fetch,
    );

    const result = await service.getEvent("cal-b", "evt-cal-b-first");

    expect(result.data).toMatchObject({
      id: "evt-cal-b-first",
      calendarId: "cal-b",
      description: "Event summary",
      descriptionMarkdown: "## Event details",
      hosts: [
        {
          id: "usr-alice",
          name: "Alice",
          avatarUrl: "https://images.example.com/alice.png",
        },
        { id: "usr-bob", name: "Bob", avatarUrl: null },
      ],
      guestCount: 42,
      registrationOpen: true,
      spotsRemaining: 8,
      requireApproval: true,
      waitlistEnabled: true,
      displayPrice: { amount: 1500, currency: "usd", isFlexible: false },
    });
    const detailCall = fetchImplementation.mock.calls.find(([input]) =>
      String(input).includes("/v1/events/get"),
    );
    expect(new Headers(detailCall?.[1]?.headers).get("x-luma-api-key")).toBe("key-b");
  });

  it("does not expose guest-only locations or private meeting links", async () => {
    const service = new LumaService(["key-a"], createFetch() as unknown as typeof fetch);

    const result = await service.getEvent("cal-a", "evt-private-location");

    expect(result.data.location).toBeNull();
    expect(JSON.stringify(result)).not.toContain("meet.example.com");
  });

  it("does not return private event details", async () => {
    const service = new LumaService(["key-a"], createFetch() as unknown as typeof fetch);

    await expect(service.getEvent("cal-a", "evt-private")).rejects.toThrow("Luma event not found");
  });
});
