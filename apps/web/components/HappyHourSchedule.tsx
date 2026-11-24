"use client";

import { useMemo } from "react";
import { HappyHourWeekStrip } from "@/components/HappyHourWeekStrip";
import { useTodayDayOfWeek } from "@/hooks/useTodayDayOfWeek";
import {
  consolidateEventSchedules,
  type EventSchedule,
} from "@/lib/events";

type HappyHourScheduleProps = {
  schedules: EventSchedule[];
  emptyLabel?: string;
};

/** Client-only consolidation so "today" doesn't run during prerender. */
export function HappyHourSchedule({
  schedules,
  emptyLabel,
}: HappyHourScheduleProps) {
  const today = useTodayDayOfWeek();
  const pills = useMemo(
    () => consolidateEventSchedules(schedules, today),
    [schedules, today],
  );

  return <HappyHourWeekStrip pills={pills} emptyLabel={emptyLabel} />;
}
