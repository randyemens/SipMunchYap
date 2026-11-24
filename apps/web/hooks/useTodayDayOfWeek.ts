"use client";

import { startTransition, useEffect, useState } from "react";
import { getTodayDayOfWeek } from "@/lib/events";

/** Resolves after mount so SSR/prerender never reads `new Date()`. */
export function useTodayDayOfWeek(): number | null {
  const [today, setToday] = useState<number | null>(null);

  useEffect(() => {
    startTransition(() => {
      setToday(getTodayDayOfWeek());
    });
  }, []);

  return today;
}
