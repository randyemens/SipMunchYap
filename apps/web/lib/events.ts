import type { MerchantCategoryLink, GoogleRating } from "@/lib/merchants";

export type EventSortBy =
  | "default"
  | "highest_rated"
  | "most_reviewed"
  | "distance"
  | "relevance";

export type EventSchedule = {
  id: string;
  schedule_type: "recurring" | "one_off" | string;
  day_of_week: number | null;
  start_time: string;
  end_time: string;
  specific_date: string | null;
  recurrence_rule: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

export type EventMenu = {
  id: string;
  title: string;
  menu_type: string | null;
  menu_text: string | null;
  source_url: string | null;
  source_label: string | null;
  display_order: number | null;
};

/** One event row from GET /events, with merchant fields denormalized for list UI. */
export type EventListItem = {
  id: string;
  merchant_id: number;
  event_type: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category_tags: string[] | null;
  is_verified: boolean;
  source_url: string | null;
  source_label: string | null;
  display_order: number;
  restaurant_name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: string | number | null;
  longitude: string | number | null;
  logo_url: string | null;
  neighborhood: string | null;
  slug: string | null;
  sort_value?: string | number | null;
  event_schedules: EventSchedule[];
  menus: EventMenu[];
  merchant_categories: MerchantCategoryLink[];
  merchant_google_ratings: GoogleRating[];
};

export type EventsResponse = {
  data: EventListItem[];
  pagination: {
    limit: number;
    sortBy: EventSortBy;
    hasMore: boolean;
    nextCursor: string | null;
    total: number | null;
  };
};

export type FetchEventsParams = {
  limit?: number;
  cursor?: string | null;
  sortBy?: EventSortBy;
  search?: string;
  eventTypes?: string[];
  tags?: string[];
  neighborhood?: string;
  categoryIds?: string[];
  days?: number[];
  startTime?: string;
  endTime?: string;
  menuType?: "food_and_drinks" | "drinks_only";
  offers?: boolean;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
};

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

export async function fetchEvents(
  params: FetchEventsParams = {},
): Promise<EventsResponse> {
  const url = new URL(`${getApiBase()}/events`);
  url.searchParams.set("limit", String(params.limit ?? 30));
  url.searchParams.set("sortBy", params.sortBy ?? "default");
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.eventTypes?.length) {
    url.searchParams.set("eventTypes", params.eventTypes.join(","));
  }
  if (params.tags?.length) {
    url.searchParams.set("tags", params.tags.join(","));
  }
  if (params.neighborhood) {
    url.searchParams.set("neighborhood", params.neighborhood);
  }
  if (params.categoryIds?.length) {
    url.searchParams.set("categoryIds", params.categoryIds.join(","));
  }
  if (params.days?.length) {
    url.searchParams.set("days", params.days.join(","));
  }
  if (params.startTime) url.searchParams.set("startTime", params.startTime);
  if (params.endTime) url.searchParams.set("endTime", params.endTime);
  if (params.menuType) url.searchParams.set("menuType", params.menuType);
  if (params.offers) url.searchParams.set("offers", "true");
  if (params.lat != null) url.searchParams.set("lat", String(params.lat));
  if (params.lng != null) url.searchParams.set("lng", String(params.lng));
  if (params.radiusMiles != null) {
    url.searchParams.set("radiusMiles", String(params.radiusMiles));
  }
  if (params.north != null) url.searchParams.set("north", String(params.north));
  if (params.south != null) url.searchParams.set("south", String(params.south));
  if (params.east != null) url.searchParams.set("east", String(params.east));
  if (params.west != null) url.searchParams.set("west", String(params.west));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Failed to fetch events (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<EventsResponse>;
}

export function getEventMerchantHref(
  event: Pick<EventListItem, "merchant_id" | "slug">,
): string {
  return `/restaurant/${event.slug || event.merchant_id}`;
}

export function getEventDisplayRating(event: EventListItem): {
  rating: number;
  count: number | null;
  source: "google" | null;
} | null {
  const google = event.merchant_google_ratings?.[0];
  if (
    google?.google_rating != null &&
    google.match_confidence !== "no_match"
  ) {
    return {
      rating: google.google_rating,
      count: google.google_review_count,
      source: "google",
    };
  }
  return null;
}

/** event_schedules.day_of_week is Sun=0 … Sat=6 */
const DAY_SHORT = ["Su", "M", "Tu", "W", "Th", "F", "Sa"] as const;

function normalizeTime(time: string): string {
  const parts = time.split(":");
  if (parts.length < 2) return time;
  return `${parts[0]!.padStart(2, "0")}:${parts[1]!.padStart(2, "0")}`;
}

function parseTimeParts(time: string): {
  hours: number;
  minutes: number;
  meridiem: "AM" | "PM";
  hour12: number;
} | null {
  const normalized = normalizeTime(time);
  const [hRaw, mRaw] = normalized.split(":");
  const hours = Number(hRaw);
  const minutes = Number(mRaw ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const meridiem = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return { hours, minutes, meridiem, hour12 };
}

export function formatEventTime(time: string): string {
  const parts = parseTimeParts(time);
  if (!parts) return time;
  return `${parts.hour12}:${String(parts.minutes).padStart(2, "0")} ${parts.meridiem}`;
}

export function formatEventTimeRange(start: string, end: string): string {
  const a = parseTimeParts(start);
  const b = parseTimeParts(end);
  if (!a || !b) {
    return `${formatEventTime(start)}–${formatEventTime(end)}`;
  }
  const fmt = (p: NonNullable<ReturnType<typeof parseTimeParts>>) =>
    `${p.hour12}:${String(p.minutes).padStart(2, "0")}`;
  if (a.meridiem === b.meridiem) {
    return `${fmt(a)}–${fmt(b)} ${a.meridiem}`;
  }
  return `${fmt(a)} ${a.meridiem}–${fmt(b)} ${b.meridiem}`;
}

/** Sun=0 … Sat=6, matching event_schedules.day_of_week */
export function getTodayDayOfWeek(): number {
  return new Date().getDay();
}

function formatDayRanges(days: number[]): string {
  if (days.length === 0) return "";
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;

  const pushRange = (from: number, to: number) => {
    const fromLabel = DAY_SHORT[from] ?? String(from);
    const toLabel = DAY_SHORT[to] ?? String(to);
    ranges.push(from === to ? fromLabel : `${fromLabel}-${toLabel}`);
  };

  for (let i = 1; i < sorted.length; i++) {
    const day = sorted[i]!;
    if (day === prev + 1) {
      prev = day;
      continue;
    }
    pushRange(start, prev);
    start = day;
    prev = day;
  }
  pushRange(start, prev);
  return ranges.join(", ");
}

export type SchedulePill = {
  key: string;
  label: string;
  dayLabel: string;
  timeLabel: string;
  days: number[];
  start: string;
  end: string;
  includesToday: boolean;
};

/**
 * Group recurring schedules that share the same time window and consolidate
 * consecutive days. One-off dates become their own pills.
 */
export function consolidateEventSchedules(
  schedules: EventSchedule[],
  todayDayOfWeek: number | null = null,
): SchedulePill[] {
  if (!schedules.length) return [];

  const byTime = new Map<string, number[]>();
  const oneOffs: SchedulePill[] = [];

  for (const schedule of schedules) {
    const start = normalizeTime(schedule.start_time);
    const end = normalizeTime(schedule.end_time);

    if (schedule.schedule_type === "one_off" && schedule.specific_date) {
      const date = new Date(`${schedule.specific_date}T12:00:00`);
      const dow = Number.isFinite(date.getTime()) ? date.getDay() : null;
      const dayLabel =
        dow != null
          ? (DAY_SHORT[dow] ?? schedule.specific_date)
          : schedule.specific_date;
      const timeLabel = formatEventTimeRange(start, end);
      oneOffs.push({
        key: `one-off-${schedule.id}`,
        label: `${dayLabel} ${timeLabel}`,
        dayLabel,
        timeLabel,
        days: dow != null ? [dow] : [],
        start,
        end,
        includesToday: dow != null && todayDayOfWeek === dow,
      });
      continue;
    }

    if (schedule.day_of_week == null) continue;
    const key = `${start}|${end}`;
    const days = byTime.get(key) ?? [];
    if (!days.includes(schedule.day_of_week)) days.push(schedule.day_of_week);
    byTime.set(key, days);
  }

  const pills: SchedulePill[] = [...oneOffs];
  for (const [key, days] of byTime) {
    const [start, end] = key.split("|") as [string, string];
    const sortedDays = [...days].sort((a, b) => a - b);
    const dayLabel = formatDayRanges(sortedDays);
    const timeLabel = formatEventTimeRange(start, end);
    pills.push({
      key,
      label: `${dayLabel} ${timeLabel}`,
      dayLabel,
      timeLabel,
      days: sortedDays,
      start,
      end,
      includesToday:
        todayDayOfWeek != null && sortedDays.includes(todayDayOfWeek),
    });
  }

  pills.sort((a, b) => {
    if (a.includesToday !== b.includesToday) return a.includesToday ? -1 : 1;
    const dayDiff = (a.days[0] ?? 99) - (b.days[0] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return a.start.localeCompare(b.start);
  });

  return pills;
}
