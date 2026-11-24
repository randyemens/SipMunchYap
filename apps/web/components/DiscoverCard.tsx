"use client";

import { MapPin, Star, Store } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  consolidateEventSchedules,
  getEventDisplayRating,
  getEventMerchantHref,
  getTodayDayOfWeek,
  type EventListItem,
} from "@/lib/events";

/** Compact event card for the Discover carousels. */
export function DiscoverCard({ event }: { event: EventListItem }) {
  const [imgError, setImgError] = useState(false);
  const [today] = useState<number | null>(() => getTodayDayOfWeek());
  const rating = getEventDisplayRating(event);
  const location = [event.neighborhood, event.city].filter(Boolean).join(", ");
  const pill = useMemo(
    () => consolidateEventSchedules(event.event_schedules, today)[0] ?? null,
    [event.event_schedules, today],
  );
  const imageUrl = event.image_url || event.logo_url;
  const showImage = Boolean(imageUrl) && !imgError;

  return (
    <Link
      href={getEventMerchantHref(event)}
      className="group flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:bg-tint md:w-64"
    >
      <div
        className={`flex h-36 w-full items-center justify-center overflow-hidden ${
          showImage
            ? "bg-logo-tile"
            : "bg-gradient-to-br from-tile-start to-tile-end"
        }`}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl!}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <Store className="h-18 w-18 text-accent-light" strokeWidth={1.5} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <h3 className="truncate text-base font-bold leading-snug text-foreground">
          {event.title}
          {event.restaurant_name ? (
            <span className="font-medium text-foreground/50">
              {" "}
              at {event.restaurant_name}
            </span>
          ) : null}
        </h3>

        <div className="flex min-w-0 items-center gap-x-3 text-sm text-foreground/70">
          {location ? (
            <p className="inline-flex min-w-0 items-center gap-1">
              <MapPin
                className="h-3.5 w-3.5 shrink-0 text-foreground/50"
                aria-hidden="true"
              />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
          {rating ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Star
                className="h-3.5 w-3.5 fill-star text-star"
                aria-hidden="true"
              />
              <span className="font-semibold tabular-nums">
                {rating.rating.toFixed(1)}
              </span>
            </span>
          ) : null}
        </div>

        {pill ? (
          <span
            className={`mt-auto inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              pill.includesToday
                ? "bg-sunset text-on-accent"
                : "bg-happy-hour-muted text-on-accent"
            }`}
          >
            <span>{pill.dayLabel}</span>
            <span
              className="inline-block h-1 w-1 shrink-0 rounded-full bg-current opacity-45"
              aria-hidden="true"
            />
            <span className="truncate tabular-nums">{pill.timeLabel}</span>
          </span>
        ) : (
          <span className="mt-auto inline-flex w-fit items-center rounded-full bg-tint-strong px-2.5 py-1 text-xs font-semibold text-foreground/60">
            Schedule TBA
          </span>
        )}
      </div>
    </Link>
  );
}
