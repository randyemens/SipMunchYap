import type { SchedulePill } from "@/lib/events";

/** Sun=0 … Sat=6, matching event_schedules.day_of_week. */
const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

type HappyHourWeekStripProps = {
  pills: SchedulePill[];
  emptyLabel?: string;
};

/** Full week-strip schedule — better on merchant detail than dense list rows. */
export function HappyHourWeekStrip({
  pills,
  emptyLabel = "No happy hour listed",
}: HappyHourWeekStripProps) {
  if (pills.length === 0) {
    return (
      <span className="inline-flex w-fit items-center rounded-xl bg-tint px-2.5 py-1.5 text-sm text-foreground/55">
        {emptyLabel}
      </span>
    );
  }

  return (
    <div className="inline-flex w-fit max-w-full flex-col gap-1.5">
      {pills.map((pill) => (
        <div
          key={pill.key}
          className={`inline-flex w-fit max-w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 ${
            pill.includesToday
              ? "bg-happy-hour text-on-accent"
              : "bg-happy-hour-soft text-happy-hour-text"
          }`}
        >
          <div
            className="flex shrink-0 items-center gap-0.5"
            aria-label={pill.dayLabel}
          >
            {WEEK_DAYS.map((label, dayIndex) => {
              const active = pill.days.includes(dayIndex);
              return (
                <span
                  key={`${pill.key}-${dayIndex}`}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                    pill.includesToday
                      ? active
                        ? "bg-on-accent text-happy-hour-deep"
                        : "text-on-accent/35"
                      : active
                        ? "bg-happy-hour text-on-accent"
                        : "text-happy-hour-text/25"
                  }`}
                >
                  {label}
                </span>
              );
            })}
          </div>

          {pill.includesToday ? (
            <span className="rounded-md bg-on-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-accent">
              Today
            </span>
          ) : null}

          <span
            className={`text-sm font-semibold tabular-nums ${
              pill.includesToday ? "text-on-accent" : "text-happy-hour-text"
            }`}
          >
            {pill.timeLabel}
          </span>
        </div>
      ))}
    </div>
  );
}
