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

type MerchantListRowProps = {
  event: EventListItem;
  selected?: boolean;
  onHover?: (merchantId: number | null) => void;
  onSelect?: (event: EventListItem) => void;
  /** Shown when the list is sorted by distance. */
  distanceMiles?: number | null;
};

export function MerchantListRow({
  event,
  selected = false,
  onHover,
  onSelect,
  distanceMiles = null,
}: MerchantListRowProps) {
  const [imgError, setImgError] = useState(false);
  const [today] = useState<number | null>(() => getTodayDayOfWeek());
  const rating = getEventDisplayRating(event);
  const tags = (event.category_tags ?? []).slice(0, 3);
  const location = [event.neighborhood, event.city].filter(Boolean).join(", ");
  const schedulePills = useMemo(
    () => consolidateEventSchedules(event.event_schedules, today),
    [event.event_schedules, today],
  );
  const imageUrl = event.image_url || event.logo_url;
  const showImage = Boolean(imageUrl) && !imgError;

  return (
    <Link
      href={getEventMerchantHref(event)}
      aria-current={selected ? "true" : undefined}
      className={`flex items-center gap-4 border-b border-line px-3 py-4 transition-colors hover:bg-tint focus-visible:bg-tint focus-visible:outline-none ${
        selected ? "bg-selected" : ""
      }`}
      onClick={(e) => {
        if (!onSelect) return;
        if (
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0
        ) {
          return;
        }
        e.preventDefault();
        onSelect(event);
      }}
      onMouseEnter={() => onHover?.(event.merchant_id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(event.merchant_id)}
      onBlur={() => onHover?.(null)}
    >
      <div
        className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
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
            width={96}
            height={96}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <Store className="h-10 w-10 text-accent-light" strokeWidth={1.5} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-xl font-bold leading-snug text-foreground">
          {event.title}
          {event.restaurant_name ? (
            <span className="font-medium text-foreground/50">
              {" "}
              at {event.restaurant_name}
            </span>
          ) : null}
        </h2>

        {(location || rating || distanceMiles != null) && (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {location ? (
              <p className="inline-flex min-w-0 items-center gap-1 truncate text-sm font-medium text-foreground/70">
                <MapPin
                  className="h-3.5 w-3.5 shrink-0 text-foreground/50"
                  aria-hidden="true"
                />
                <span className="truncate">{location}</span>
              </p>
            ) : null}
            {rating ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm text-foreground/70">
                <Star
                  className="h-3.5 w-3.5 fill-star text-star"
                  aria-hidden="true"
                />
                <span className="font-semibold tabular-nums">
                  {rating.rating.toFixed(1)}
                </span>
                {rating.count != null ? (
                  <span className="text-foreground/50">({rating.count})</span>
                ) : null}
              </span>
            ) : null}
            {distanceMiles != null ? (
              <span className="inline-flex shrink-0 items-center text-sm font-semibold tabular-nums text-foreground/70">
                {distanceMiles.toFixed(1)} mi
              </span>
            ) : null}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {schedulePills.length > 0 ? (
            schedulePills.map((pill) => (
              <span
                key={pill.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  pill.includesToday
                    ? "bg-sunset text-on-accent"
                    : "bg-happy-hour-muted text-on-accent"
                }`}
                title={pill.includesToday ? `Today · ${pill.label}` : pill.label}
              >
                <span>{pill.dayLabel}</span>
                <span
                  className="inline-block h-1 w-1 shrink-0 rounded-full bg-current opacity-45"
                  aria-hidden="true"
                />
                <span className="tabular-nums">{pill.timeLabel}</span>
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-full bg-tint-strong px-2.5 py-1 text-xs font-semibold text-foreground/60">
              Schedule TBA
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tags.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-full border border-line-strong bg-tint px-2 py-0.5 text-xs font-medium text-foreground/60"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
