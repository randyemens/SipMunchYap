"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DiscoverCard } from "@/components/DiscoverCard";
import { discoverQuery, type DiscoverSection } from "@/lib/discover";
import { fetchEvents, type EventListItem } from "@/lib/events";

/** One horizontally scrolling carousel on the Discover page. */
export function DiscoverRow({ section }: { section: DiscoverSection }) {
  const [events, setEvents] = useState<EventListItem[] | null>(null);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEvents(discoverQuery(section))
      .then((res) => {
        if (!cancelled) setEvents(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  // Nothing matched (e.g. "Happening now" late at night): skip the row.
  if (events && events.length === 0) return null;

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section aria-labelledby={`discover-${section.id}`}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={`discover-${section.id}`}
            className="text-xl font-semibold text-foreground md:text-2xl"
          >
            {section.title}
          </h2>
          <p className="mt-0.5 text-sm text-foreground/60">
            {section.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden gap-1 md:flex">
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              aria-label={`Scroll ${section.title} back`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-surface-raised text-foreground hover:bg-tint-strong"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              aria-label={`Scroll ${section.title} forward`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-surface-raised text-foreground hover:bg-tint-strong"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Link
            href={section.viewAllHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line-strong bg-surface-raised px-3 text-sm font-medium text-foreground hover:bg-tint-strong"
          >
            View all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {error ? (
        <p className="py-6 text-sm text-danger">
          Couldn&apos;t load {section.title.toLowerCase()}. Try again later.
        </p>
      ) : (
        <div
          ref={scrollRef}
          className="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:-mx-6 md:scroll-px-6 md:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {events
            ? events.map((event) => (
                <DiscoverCard key={event.id} event={event} />
              ))
            : Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="h-64 w-60 shrink-0 animate-pulse rounded-2xl bg-tint md:w-64"
                />
              ))}
        </div>
      )}
    </section>
  );
}
