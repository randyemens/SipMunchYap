"use client";

import { ChevronDown, X } from "lucide-react";
import {
  DAY_OPTIONS,
  defaultCustomSchedule,
  NO_SCHEDULE,
  TIME_OPTIONS,
  type ScheduleMode,
  type ScheduleSelection,
} from "@/lib/filters";

const OPTIONS: { mode: ScheduleMode; label: string }[] = [
  { mode: "none", label: "Anytime" },
  { mode: "now", label: "Now" },
  { mode: "today", label: "Today" },
  { mode: "custom", label: "Custom" },
];

type ScheduleProps = {
  value: ScheduleSelection;
  onChange: (next: ScheduleSelection) => void;
  /**
   * Narrower buttons that follow the search bar's width (container queries)
   * instead of the viewport's: fills the line when narrow, natural width when wide.
   */
  compact?: boolean;
};

/**
 * "When" button group (one joined control) that sits next to the location bar. Changing them only updates
 * the pending selection; the search itself fires from the enter button.
 * "Anytime" is the default (no schedule). Clicking the active option falls back to Anytime.
 */
export function ScheduleSelector({
  value,
  onChange,
  compact = false,
}: ScheduleProps) {
  return (
    <div
      role="group"
      aria-label="When"
      className={`grid h-12 w-full grid-cols-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg ${
        compact ? "@[48rem]:flex @[48rem]:w-auto" : "md:w-auto"
      }`}
    >
      {OPTIONS.map(({ mode, label }, index) => {
        const selected = value.scheduleMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() =>
              onChange(
                selected
                  ? NO_SCHEDULE
                  : mode === "custom"
                    ? defaultCustomSchedule()
                    : { ...NO_SCHEDULE, scheduleMode: mode },
              )
            }
            aria-pressed={selected}
            className={`h-full whitespace-nowrap text-sm font-medium transition-colors ${
              compact ? "px-2 @[48rem]:px-3.5" : "px-5"
            } ${
              index > 0 ? "border-l border-line" : ""
            } ${
              selected
                ? "bg-sunset text-on-accent"
                : "text-foreground/80 hover:bg-tint-strong hover:text-foreground"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Extra inputs for the search, shown for as long as "Custom" is selected.
 * Nothing to confirm: whatever is set here is part of the next search. The X
 * turns Custom off.
 */
export function CustomScheduleFields({ value, onChange }: ScheduleProps) {
  const toggleDay = (day: number) => {
    const days = value.days.includes(day)
      ? value.days.filter((d) => d !== day)
      : [...value.days, day].sort((a, b) => a - b);
    onChange({ ...value, scheduleMode: "custom", days });
  };

  const setTime = (field: "startTime" | "endTime", next: string) => {
    onChange({
      ...value,
      scheduleMode: "custom",
      [field]: next === "__none__" ? "" : next,
    });
  };

  return (
    <div
      role="group"
      aria-label="Custom schedule"
      className="relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 pr-14 shadow-lg md:flex-row md:flex-wrap md:items-end md:gap-8"
    >
      <button
        type="button"
        onClick={() => onChange(NO_SCHEDULE)}
        aria-label="Remove custom schedule"
        title="Remove custom schedule"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-tint-strong hover:text-foreground"
      >
        <X className="h-5 w-5" />
      </button>

      <div>
        <h4 className="mb-2 text-xs font-semibold text-foreground/80">
          Days of the week
        </h4>
        <div className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((day) => {
            const selected = value.days.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                aria-pressed={selected}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  selected
                    ? "bg-sunset text-on-accent"
                    : "border border-line-strong text-foreground/80 hover:border-accent-light"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold text-foreground/80">
          Happy hour time
        </h4>
        <div className="flex gap-3">
          {(
            [
              ["startTime", "Start"],
              ["endTime", "End"],
            ] as const
          ).map(([field, label]) => (
            <label
              key={field}
              className="flex flex-1 items-center gap-2 text-xs text-foreground/70 md:flex-none"
            >
              {label}
              <span className="relative block w-full md:w-36">
                <select
                  className="h-10 w-full appearance-none rounded-xl border border-line-strong bg-background pl-3 pr-10 text-sm text-foreground"
                  value={value[field] || "__none__"}
                  onChange={(e) => setTime(field, e.target.value)}
                >
                  <option value="__none__">Any</option>
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/60"
                  aria-hidden="true"
                />
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
