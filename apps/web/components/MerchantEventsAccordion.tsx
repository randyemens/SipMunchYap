"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { DealDescription, DealTitle } from "@/components/DealDescription";
import { HappyHourSchedule } from "@/components/HappyHourSchedule";
import type { MerchantEvent } from "@/lib/merchants";

/** Collapsible event list for the merchant page. All sections start closed. */
export function MerchantEventsAccordion({ events }: { events: MerchantEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-foreground/55">No events listed yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {events.map((event) => (
        <li key={event.id}>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 py-4 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
              <h3 className="min-w-0 flex-1 text-lg font-semibold text-foreground">
                {event.title}
              </h3>
              <ChevronDown
                className="h-5 w-5 shrink-0 text-foreground/50 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>

            <div className="pb-5">
              {event.description ? (
                <DealDescription
                  text={event.description}
                  className="text-sm leading-relaxed text-foreground/70"
                />
              ) : null}

              <div className={event.description ? "mt-4" : undefined}>
                <h4 className="mb-2 text-sm font-semibold text-foreground/70">
                  Schedule
                </h4>
                <HappyHourSchedule
                  schedules={event.event_schedules ?? []}
                  emptyLabel="No schedule listed"
                />
              </div>

              {(event.menus ?? []).length > 0 ? (
                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-semibold text-foreground/70">
                    Menu
                  </h4>
                  <ul className="space-y-3">
                    {(event.menus ?? []).map((menu) => (
                      <li key={menu.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <DealTitle
                              text={menu.title}
                              className="text-sm font-semibold text-foreground"
                            />
                            <DealDescription
                              text={menu.menu_text}
                              className="mt-1 text-sm leading-relaxed text-foreground/70"
                            />
                            {menu.menu_type ? (
                              <span className="mt-2 inline-flex rounded-full bg-tint px-2 py-0.5 text-xs font-medium text-foreground/55">
                                {menu.menu_type}
                              </span>
                            ) : null}
                          </div>
                          {menu.source_url ? (
                            <a
                              href={menu.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sunset sunset-hover px-3 py-2 text-sm font-semibold text-on-accent transition-colors"
                            >
                              <ExternalLink
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              {menu.source_label?.trim() || "View menu"}
                            </a>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
