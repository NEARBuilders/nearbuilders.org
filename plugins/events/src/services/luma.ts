const LUMA_API_URL = "https://public-api.luma.com";
const CALENDAR_CACHE_TTL_MS = 60 * 60 * 1000;
const EVENT_CACHE_TTL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CACHE_ENTRIES = 200;

type FetchImplementation = typeof fetch;

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type LumaCalendarLocation = {
  city?: unknown;
  timezone?: unknown;
};

type LumaCalendarResponse = {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  avatar_url?: unknown;
  url?: unknown;
  description?: unknown;
  cover_image_url?: unknown;
  location?: unknown;
};

type LumaEventResponse = {
  platform?: unknown;
  id?: unknown;
  calendar_id?: unknown;
  name?: unknown;
  url?: unknown;
  cover_url?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  timezone?: unknown;
  geo_address_json?: unknown;
  location_type?: unknown;
  visibility?: unknown;
  access?: unknown;
  location_visibility?: unknown;
  event?: unknown;
  description?: unknown;
  description_md?: unknown;
  hosts?: unknown;
  guest_counts?: unknown;
  registration_open?: unknown;
  spots_remaining?: unknown;
  require_approval?: unknown;
  waitlist_status?: unknown;
  display_price?: unknown;
};

type LumaEventPageResponse = {
  entries?: unknown;
  has_more?: unknown;
  next_cursor?: unknown;
};

type CalendarRegistry = {
  calendars: LumaCalendarRecord[];
  keyByCalendarId: Map<string, string>;
  unavailableCount: number;
};

type CalendarEventPage = {
  events: LumaEventRecord[];
  nextCursor: string | null;
};

type CursorState = Record<string, string | null>;

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
) {
  const now = Date.now();
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey);
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: now + ttlMs });
}

function cacheTimeBoundary(value?: string) {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  return new Date(Math.floor(timestamp / EVENT_CACHE_TTL_MS) * EVENT_CACHE_TTL_MS).toISOString();
}

export type LumaCalendarRecord = {
  id: string;
  name: string;
  slug: string | null;
  url: string;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  description: string | null;
  timezone: string | null;
};

export type LumaEventRecord = {
  id: string;
  calendarId: string;
  platform: "luma" | "external";
  title: string;
  url: string;
  coverUrl: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string;
  location: string | null;
  locationType: string | null;
  visibility: "public" | "members-only" | "private";
  access: "manage" | "view" | null;
};

export type LumaEventDetailsRecord = LumaEventRecord & {
  description: string | null;
  descriptionMarkdown: string | null;
  hosts: LumaHostRecord[];
  guestCount: number;
  registrationOpen: boolean;
  spotsRemaining: number | null;
  requireApproval: boolean;
  waitlistEnabled: boolean;
  displayPrice: LumaDisplayPrice | null;
};

export type LumaHostRecord = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type LumaDisplayPrice = {
  amount: number;
  currency: string;
  isFlexible: boolean;
};

export type ListLumaEventsInput = {
  after?: string;
  before?: string;
  cursor?: string;
  limitPerCalendar?: number;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNullableString(value: unknown): string | null {
  return readString(value) ?? null;
}

function readHttpUrl(value: unknown): string | undefined {
  const url = readString(value);
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function readNullableHttpUrl(value: unknown): string | null {
  return readHttpUrl(value) ?? null;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeDate(value: unknown): string | undefined {
  const date = readString(value);
  if (!date) return undefined;
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function normalizeCalendar(value: unknown): LumaCalendarRecord {
  const calendar = readObject(value) as LumaCalendarResponse | undefined;
  if (!calendar) throw new Error("Luma returned invalid calendar details");
  const id = readString(calendar.id);
  const name = readString(calendar.name);
  const url = readHttpUrl(calendar.url);
  if (!id || !name || !url) throw new Error("Luma returned invalid calendar details");

  const location = readObject(calendar.location) as LumaCalendarLocation | undefined;
  return {
    id,
    name,
    slug: readNullableString(calendar.slug),
    url,
    avatarUrl: readNullableHttpUrl(calendar.avatar_url),
    coverImageUrl: readNullableHttpUrl(calendar.cover_image_url),
    description: readNullableString(calendar.description),
    timezone: readNullableString(location?.timezone),
  };
}

function readLocation(value: unknown): string | null {
  const location = readObject(value);
  if (!location) return null;
  return (
    readString(location.full_address) ??
    readString(location.address) ??
    readString(location.city_state) ??
    readString(location.city) ??
    null
  );
}

function normalizeEvent(value: unknown, calendarId: string): LumaEventRecord | null {
  const entry = readObject(value) as LumaEventResponse | undefined;
  const nested = readObject(entry?.event) as LumaEventResponse | undefined;
  const event = nested ?? entry;
  if (!event) return null;
  const id = readString(event.id) ?? readString((event as Record<string, unknown>).api_id);
  const title = readString(event.name);
  const url = readHttpUrl(event.url);
  const startAt = normalizeDate(event.start_at);
  const platform =
    event.platform === "luma" || event.platform === "external" ? event.platform : null;
  const visibility =
    event.visibility === "public" ||
    event.visibility === "private" ||
    event.visibility === "members-only"
      ? event.visibility
      : null;
  if (!id || !title || !url || !startAt || !platform || !visibility) return null;

  return {
    id,
    calendarId,
    platform,
    title,
    url,
    coverUrl: readNullableHttpUrl(event.cover_url),
    startAt,
    endAt: normalizeDate(event.end_at) ?? null,
    timezone: readString(event.timezone) ?? "UTC",
    location:
      event.location_visibility === "public" || platform === "external"
        ? readLocation(event.geo_address_json)
        : null,
    locationType: readNullableString(event.location_type),
    visibility,
    access: event.access === "manage" || event.access === "view" ? event.access : null,
  };
}

function readNonnegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function readGuestCount(value: unknown): number {
  return readNonnegativeNumber(readObject(value)?.guests);
}

function normalizeHost(value: unknown): LumaHostRecord | null {
  const host = readObject(value);
  if (!host) return null;
  const id = readString(host.id);
  const name =
    readString(host.name) ??
    [readString(host.first_name), readString(host.last_name)].filter(Boolean).join(" ");
  if (!id || !name) return null;
  return { id, name, avatarUrl: readNullableHttpUrl(host.avatar_url) };
}

function normalizeDisplayPrice(value: unknown): LumaDisplayPrice | null {
  const price = readObject(value);
  const currency = readString(price?.currency);
  if (!price || !currency || typeof price.amount !== "number" || price.amount < 0) return null;
  return {
    amount: price.amount,
    currency,
    isFlexible: price.is_flexible === true,
  };
}

function normalizeEventDetails(value: unknown, calendarId: string): LumaEventDetailsRecord {
  const event = readObject(value) as LumaEventResponse | undefined;
  const normalized = normalizeEvent(event, calendarId);
  if (!event || !normalized) throw new Error("Luma returned invalid event details");
  const hosts = Array.isArray(event.hosts) ? event.hosts : [];
  const guestCounts = readObject(event.guest_counts);
  const guestCount = readGuestCount(guestCounts?.approved);

  return {
    ...normalized,
    description: readNullableString(event.description),
    descriptionMarkdown: readNullableString(event.description_md),
    hosts: hosts.map(normalizeHost).filter((host): host is LumaHostRecord => Boolean(host)),
    guestCount,
    registrationOpen: event.registration_open === true,
    spotsRemaining:
      typeof event.spots_remaining === "number" && event.spots_remaining >= 0
        ? event.spots_remaining
        : null,
    requireApproval: event.require_approval === true,
    waitlistEnabled: event.waitlist_status === "enabled",
    displayPrice: normalizeDisplayPrice(event.display_price),
  };
}

function encodeCursor(state: CursorState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeCursor(cursor?: string): CursorState {
  if (!cursor) return {};
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!readObject(parsed)) throw new Error("Invalid cursor");
    const state: CursorState = {};
    for (const [calendarId, value] of Object.entries(parsed)) {
      if (value !== null && typeof value !== "string") throw new Error("Invalid cursor");
      state[calendarId] = value;
    }
    return state;
  } catch {
    throw new Error("Invalid Luma pagination cursor");
  }
}

export function parseLumaApiKeys(value: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value || "[]");
  } catch {
    throw new Error("LUMA_CALENDAR_API_KEYS must be a JSON array of strings");
  }
  if (!Array.isArray(parsed) || parsed.some((key) => typeof key !== "string")) {
    throw new Error("LUMA_CALENDAR_API_KEYS must be a JSON array of strings");
  }
  return [...new Set(parsed.map((key) => key.trim()).filter(Boolean))];
}

export class LumaService {
  private calendarCache: CacheEntry<CalendarRegistry> | undefined;
  private calendarRequest: Promise<CalendarRegistry> | undefined;
  private readonly eventCache = new Map<string, CacheEntry<CalendarEventPage>>();
  private readonly detailCache = new Map<string, CacheEntry<LumaEventDetailsRecord>>();
  private readonly eventRequests = new Map<string, Promise<CalendarEventPage>>();
  private readonly detailRequests = new Map<string, Promise<LumaEventDetailsRecord>>();

  constructor(
    private readonly apiKeys: string[],
    private readonly fetchImplementation: FetchImplementation = fetch,
  ) {}

  async listCalendars() {
    const registry = await this.getCalendarRegistry();
    return {
      data: registry.calendars,
      unavailableCount: registry.unavailableCount,
    };
  }

  async listEvents(input: ListLumaEventsInput) {
    const registry = await this.getCalendarRegistry();
    const cursorState = decodeCursor(input.cursor);
    const nextState: CursorState = {};
    const unavailableCalendarIds: string[] = [];
    const events: LumaEventRecord[] = [];
    const limit = Math.min(Math.max(input.limitPerCalendar ?? 20, 1), 50);

    const requests = registry.calendars.map(async (calendar) => {
      const currentCursor = Object.hasOwn(cursorState, calendar.id)
        ? cursorState[calendar.id]
        : undefined;
      if (currentCursor === null) {
        nextState[calendar.id] = null;
        return;
      }

      const apiKey = registry.keyByCalendarId.get(calendar.id);
      if (!apiKey) {
        unavailableCalendarIds.push(calendar.id);
        nextState[calendar.id] = null;
        return;
      }

      try {
        const page = await this.getCalendarEventPage(calendar.id, apiKey, {
          after: input.after,
          before: input.before,
          cursor: currentCursor ?? undefined,
          limit,
        });
        events.push(...page.events);
        nextState[calendar.id] = page.nextCursor;
      } catch {
        unavailableCalendarIds.push(calendar.id);
        nextState[calendar.id] = null;
      }
    });

    await Promise.all(requests);
    events.sort((left, right) => {
      const direction = input.before && !input.after ? -1 : 1;
      const startDifference = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
      return (
        direction * startDifference ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id)
      );
    });

    const hasMore = Object.values(nextState).some((cursor) => typeof cursor === "string");
    return {
      data: events,
      meta: {
        hasMore,
        nextCursor: hasMore ? encodeCursor(nextState) : null,
      },
      unavailableCalendarIds,
    };
  }

  async getEvent(calendarId: string, eventId: string) {
    const cacheKey = `${calendarId}:${eventId}`;
    const cached = getCachedValue(this.detailCache, cacheKey);
    if (cached) return { data: cached };
    const pending = this.detailRequests.get(cacheKey);
    if (pending) return { data: await pending };

    const request = this.loadEvent(calendarId, eventId);
    this.detailRequests.set(cacheKey, request);
    try {
      const details = await request;
      setCachedValue(this.detailCache, cacheKey, details, EVENT_CACHE_TTL_MS);
      return { data: details };
    } finally {
      this.detailRequests.delete(cacheKey);
    }
  }

  private async getCalendarRegistry(): Promise<CalendarRegistry> {
    if (this.calendarCache && this.calendarCache.expiresAt > Date.now()) {
      return this.calendarCache.value;
    }
    if (this.calendarRequest) return this.calendarRequest;

    this.calendarRequest = this.loadCalendarRegistry();
    try {
      const registry = await this.calendarRequest;
      this.calendarCache = {
        value: registry,
        expiresAt:
          Date.now() + (registry.unavailableCount > 0 ? EVENT_CACHE_TTL_MS : CALENDAR_CACHE_TTL_MS),
      };
      return registry;
    } finally {
      this.calendarRequest = undefined;
    }
  }

  private async loadCalendarRegistry(): Promise<CalendarRegistry> {
    const results = await Promise.allSettled(
      this.apiKeys.map(async (apiKey) => ({
        apiKey,
        calendar: normalizeCalendar(await this.request("/v1/calendars/get", apiKey)),
      })),
    );
    const calendars: LumaCalendarRecord[] = [];
    const keyByCalendarId = new Map<string, string>();
    let unavailableCount = 0;

    for (const result of results) {
      if (result.status === "rejected") {
        unavailableCount += 1;
        continue;
      }
      if (keyByCalendarId.has(result.value.calendar.id)) continue;
      calendars.push(result.value.calendar);
      keyByCalendarId.set(result.value.calendar.id, result.value.apiKey);
    }
    calendars.sort((left, right) => left.name.localeCompare(right.name));
    return { calendars, keyByCalendarId, unavailableCount };
  }

  private async getCalendarEventPage(
    calendarId: string,
    apiKey: string,
    input: { after?: string; before?: string; cursor?: string; limit: number },
  ): Promise<CalendarEventPage> {
    const cacheKey = JSON.stringify([
      calendarId,
      {
        ...input,
        after: cacheTimeBoundary(input.after),
        before: cacheTimeBoundary(input.before),
      },
    ]);
    const cached = getCachedValue(this.eventCache, cacheKey);
    if (cached) return cached;
    const pending = this.eventRequests.get(cacheKey);
    if (pending) return pending;

    const request = this.loadCalendarEventPage(calendarId, apiKey, input);
    this.eventRequests.set(cacheKey, request);
    try {
      const page = await request;
      setCachedValue(this.eventCache, cacheKey, page, EVENT_CACHE_TTL_MS);
      return page;
    } finally {
      this.eventRequests.delete(cacheKey);
    }
  }

  private async loadEvent(calendarId: string, eventId: string) {
    const registry = await this.getCalendarRegistry();
    const apiKey = registry.keyByCalendarId.get(calendarId);
    if (!apiKey) throw new Error("Luma calendar not found");
    const search = new URLSearchParams({ event_id: eventId });
    const event = await this.request(`/v1/events/get?${search.toString()}`, apiKey);
    const record = readObject(event) as LumaEventResponse | undefined;
    if (readString(record?.calendar_id) !== calendarId || record?.visibility !== "public") {
      throw new Error("Luma event not found");
    }
    return normalizeEventDetails(event, calendarId);
  }

  private async loadCalendarEventPage(
    calendarId: string,
    apiKey: string,
    input: { after?: string; before?: string; cursor?: string; limit: number },
  ) {
    const search = new URLSearchParams({
      pagination_limit: String(input.limit),
      sort_column: "start_at",
      sort_direction: input.before && !input.after ? "desc" : "asc",
      status: "approved",
    });
    if (input.after) search.set("after", input.after);
    if (input.before) search.set("before", input.before);
    if (input.cursor) search.set("pagination_cursor", input.cursor);
    search.append("platforms", "luma");
    search.append("platforms", "external");
    search.append("access", "manage");
    search.append("access", "view");

    const response = (await this.request(
      `/v1/calendars/events/list?${search.toString()}`,
      apiKey,
    )) as LumaEventPageResponse;
    const entries = Array.isArray(response.entries) ? response.entries : [];
    const page = {
      events: entries
        .map((entry) => normalizeEvent(entry, calendarId))
        .filter((event): event is LumaEventRecord => event?.visibility === "public"),
      nextCursor: response.has_more === true ? (readString(response.next_cursor) ?? null) : null,
    };
    return page;
  }

  private async request(path: string, apiKey: string): Promise<unknown> {
    const response = await this.fetchImplementation(`${LUMA_API_URL}${path}`, {
      headers: {
        accept: "application/json",
        "x-luma-api-key": apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Luma request failed with status ${response.status}`);
    return response.json();
  }
}
