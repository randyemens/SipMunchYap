export type MenuType = "all" | "food_and_drinks" | "drinks_only";

/** none = no schedule filter; custom = manual days + time range */
export type ScheduleMode = "none" | "now" | "today" | "custom";

export type MerchantFilters = {
  categoryIds: string[];
  scheduleMode: ScheduleMode;
  days: number[];
  startTime: string;
  endTime: string;
  menuType: MenuType;
  offers: boolean;
};

export const DEFAULT_FILTERS: MerchantFilters = {
  categoryIds: [],
  scheduleMode: "none",
  days: [],
  startTime: "",
  endTime: "",
  menuType: "all",
  offers: false,
};

/** Matches event_schedules.day_of_week: 0=Sunday … 6=Saturday. */
export const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Su" },
  { value: 1, label: "M" },
  { value: 2, label: "Tu" },
  { value: 3, label: "W" },
  { value: 4, label: "Th" },
  { value: 5, label: "F" },
  { value: 6, label: "Sa" },
];

export const TIME_OPTIONS = [
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM",
  "11:00 PM",
  "12:00 AM",
  "1:00 AM",
  "2:00 AM",
] as const;

/** JS getDay() Sun=0…Sat=6 — same as event_schedules.day_of_week. */
export function dbDayOfWeek(date: Date): number {
  return date.getDay();
}

export function countActiveFilters(filters: MerchantFilters): number {
  let n = 0;
  if (filters.categoryIds.length) n += 1;
  if (filters.menuType !== "all") n += 1;
  if (filters.offers) n += 1;

  if (filters.scheduleMode === "now" || filters.scheduleMode === "today") {
    n += 1;
  } else if (filters.scheduleMode === "custom") {
    if (filters.days.length) n += 1;
    if (filters.startTime || filters.endTime) n += 1;
  }

  return n;
}

/** The "when" part of a search; lives in the search bar and the URL. */
export type ScheduleSelection = Pick<
  MerchantFilters,
  "scheduleMode" | "days" | "startTime" | "endTime"
>;

export const NO_SCHEDULE: ScheduleSelection = {
  scheduleMode: "none",
  days: [],
  startTime: "",
  endTime: "",
};

/** What "Custom" starts as when it's picked: today, 5 PM to 7 PM. */
export function defaultCustomSchedule(date: Date = new Date()): ScheduleSelection {
  return {
    scheduleMode: "custom",
    days: [dbDayOfWeek(date)],
    startTime: "5:00 PM",
    endTime: "7:00 PM",
  };
}

function validTime(value: string | null): string {
  return value && (TIME_OPTIONS as readonly string[]).includes(value)
    ? value
    : "";
}

/** Read the schedule from URL params: when=now|today|custom, days, start, end. */
export function scheduleFromSearchParams(
  params: URLSearchParams,
): ScheduleSelection {
  const when = params.get("when");
  if (when === "now" || when === "today") {
    return { ...NO_SCHEDULE, scheduleMode: when };
  }
  if (when === "custom") {
    const days = [
      ...new Set(
        (params.get("days") ?? "")
          .split(",")
          .filter((d) => d.trim() !== "")
          .map(Number)
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      ),
    ].sort((a, b) => a - b);
    return {
      scheduleMode: "custom",
      days,
      startTime: validTime(params.get("start")),
      endTime: validTime(params.get("end")),
    };
  }
  return NO_SCHEDULE;
}

/** Write the schedule into URL params (nothing is written for "none"). */
export function writeScheduleToSearchParams(
  schedule: ScheduleSelection,
  params: URLSearchParams,
): void {
  if (schedule.scheduleMode === "none") return;
  params.set("when", schedule.scheduleMode);
  if (schedule.scheduleMode !== "custom") return;
  if (schedule.days.length) params.set("days", schedule.days.join(","));
  if (schedule.startTime) params.set("start", schedule.startTime);
  if (schedule.endTime) params.set("end", schedule.endTime);
}

export type ResolvedMerchantQueryFilters = {
  categoryIds?: string[];
  days?: number[];
  startTime?: string;
  endTime?: string;
  menuType?: Exclude<MenuType, "all">;
  offers?: boolean;
};

/** Expand schedule mode into concrete days/times for the API. */
export function resolveFiltersForApi(
  filters: MerchantFilters,
): ResolvedMerchantQueryFilters {
  const resolved: ResolvedMerchantQueryFilters = {};

  if (filters.categoryIds.length) {
    resolved.categoryIds = filters.categoryIds;
  }
  if (filters.offers) resolved.offers = true;
  if (filters.menuType !== "all") resolved.menuType = filters.menuType;

  if (filters.scheduleMode === "now") {
    // Caller is client-side filter apply — safe to read the clock here.
    const clock = new Date();
    const now = clock.toTimeString().slice(0, 5);
    resolved.days = [dbDayOfWeek(clock)];
    resolved.startTime = now;
    resolved.endTime = now;
    return resolved;
  }

  if (filters.scheduleMode === "today") {
    resolved.days = [dbDayOfWeek(new Date())];
    return resolved;
  }

  if (filters.scheduleMode === "custom") {
    if (filters.days.length) resolved.days = filters.days;
    if (filters.startTime && filters.endTime) {
      resolved.startTime = filters.startTime;
      resolved.endTime = filters.endTime;
    }
  }

  return resolved;
}
