"use client";

import {
  ExternalLink,
  MapPin,
  Star,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DealDescription, DealTitle } from "@/components/DealDescription";
import { HappyHourSchedule } from "@/components/HappyHourSchedule";
import { SunsetIcon } from "@/components/SunsetIcon";
import {
  getEventDisplayRating,
  getEventMerchantHref,
  type EventListItem,
} from "@/lib/events";
import {
  fetchMerchant,
  formatMerchantAddress,
  type MerchantDetail,
} from "@/lib/merchants";

type MerchantDrawerProps = {
  event: EventListItem | null;
  onClose: () => void;
};

type DetailState = {
  key: string;
  detail: MerchantDetail | null;
  error: string | null;
};

const detailCache = new Map<string, MerchantDetail>();

function normalizeWebsiteUrl(website: string): string {
  if (/^https?:\/\//i.test(website)) return website;
  return `https://${website}`;
}

function menuTypeLabel(menuType: string): string {
  if (menuType === "food_and_drinks" || menuType === "both") return "Food & drinks";
  if (menuType === "drinks_only" || menuType === "drinks") return "Drinks";
  if (menuType === "food") return "Food";
  return menuType;
}

export function MerchantDrawer({ event, onClose }: MerchantDrawerProps) {
  const key = event ? String(event.slug || event.merchant_id) : null;
  const [state, setState] = useState<DetailState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!key || detailCache.has(key)) return;

    let cancelled = false;
    fetchMerchant(key)
      .then((detail) => {
        if (cancelled) return;
        if (detail) detailCache.set(key, detail);
        setState({
          key,
          detail,
          error: detail ? null : "We couldn't find that restaurant.",
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          key,
          detail: null,
          error:
            err instanceof Error ? err.message : "Failed to load restaurant",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!key) return;
    scrollRef.current?.scrollTo({ top: 0 });
    closeRef.current?.focus({ preventScroll: true });
  }, [key]);

  useEffect(() => {
    if (!key) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, onClose]);

  if (!event || !key) return null;

  const cached = detailCache.get(key);
  const loaded: DetailState | null = cached
    ? { key, detail: cached, error: null }
    : state?.key === key
      ? state
      : null;
  const loading = !loaded;
  const detail = loaded?.detail ?? null;

  const rating = getEventDisplayRating(event);
  const tags = [
    ...(event.category_tags ?? []),
    ...event.merchant_categories
      .map((c) => c.categories?.name)
      .filter((name): name is string => Boolean(name)),
  ].filter((name, i, arr) => arr.indexOf(name) === i);
  const locationLabel = [event.neighborhood, event.city]
    .filter(Boolean)
    .join(", ");
  const addressLines = detail ? formatMerchantAddress(detail) : [];
  const menus = event.menus ?? [];
  const imageUrl = event.image_url || event.logo_url;
  const hasContact =
    addressLines.length > 0 ||
    Boolean(detail?.phone_number?.trim()) ||
    Boolean(detail?.website?.trim());

  return (
    <aside
      role="dialog"
      aria-label={`${event.title} details`}
      className="animate-drawer-in absolute inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-surface shadow-[-8px_0_24px_var(--shadow-panel)] md:w-[min(30rem,60%)]"
    >
      <div className="flex shrink-0 items-center justify-end border-b border-line px-3 py-2">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-tint-strong hover:text-foreground"
          aria-label="Close details"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-start gap-4 px-5 pb-5 pt-4">
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${
              imageUrl
                ? "bg-logo-tile"
                : "bg-gradient-to-br from-tile-start to-tile-end"
            }`}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
                width={80}
                height={80}
              />
            ) : (
              <Store className="h-9 w-9 text-accent-light" strokeWidth={1.5} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-tight text-foreground">
              {event.title}
            </h2>
            {event.restaurant_name ? (
              <p className="mt-1 text-sm font-medium text-foreground/50">
                at{" "}
                <Link
                  href={getEventMerchantHref(event)}
                  className="font-semibold text-accent-text underline underline-offset-2 hover:opacity-80"
                >
                  {event.restaurant_name}
                </Link>
              </p>
            ) : null}

            {(locationLabel || rating) && (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                {locationLabel ? (
                  <p className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground/70">
                    <MapPin
                      className="h-4 w-4 shrink-0 text-foreground/50"
                      aria-hidden="true"
                    />
                    <span>{locationLabel}</span>
                  </p>
                ) : null}
                {rating ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-foreground/70">
                    <Star
                      className="h-4 w-4 fill-star text-star"
                      aria-hidden="true"
                    />
                    <span className="font-semibold tabular-nums">
                      {rating.rating.toFixed(1)}
                    </span>
                    {rating.count != null ? (
                      <span className="text-foreground/50">
                        ({rating.count})
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
            )}

            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center rounded-full border border-line-strong bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-foreground/65"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 px-5 pb-8">
          {event.description ? (
            <section className="rounded-2xl border border-line bg-surface-raised p-4">
              <h3 className="mb-2 text-base font-bold text-foreground">About</h3>
              <DealDescription
                text={event.description}
                className="text-sm leading-relaxed text-foreground/70"
              />
            </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-surface-raised p-4">
            <h3 className="mb-3 text-base font-bold text-foreground">
              Schedule
            </h3>
            <HappyHourSchedule
              schedules={event.event_schedules}
              emptyLabel="No schedule listed"
            />
          </section>

          <section className="rounded-2xl border border-line bg-surface-raised p-4">
            <h3 className="mb-3 text-base font-bold text-foreground">Menu</h3>
            {menus.length > 0 ? (
              <ul className="space-y-4">
                {menus.map((menu) => (
                  <li
                    key={menu.id}
                    className="border-b border-line pb-4 last:border-b-0 last:pb-0"
                  >
                    <DealTitle
                      as="h4"
                      text={menu.title}
                      className="text-sm font-semibold text-foreground"
                    />
                    <DealDescription
                      text={menu.menu_text}
                      className="mt-1 text-sm leading-relaxed text-foreground/70"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {menu.menu_type ? (
                        <span className="inline-flex rounded-full bg-tint px-2 py-0.5 text-xs font-medium text-foreground/55">
                          {menuTypeLabel(menu.menu_type)}
                        </span>
                      ) : null}
                      {menu.source_url ? (
                        <a
                          href={menu.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-sunset sunset-hover px-3 py-1.5 text-xs font-semibold text-on-accent transition-colors"
                        >
                          <ExternalLink
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {menu.source_label?.trim() || "View menu"}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/55">
                No menu listed yet.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface-raised p-4">
            <h3 className="mb-3 text-base font-bold text-foreground">
              Contact &amp; location
            </h3>
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                <div className="h-4 w-3/4 animate-pulse rounded bg-tint-strong" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-tint" />
              </div>
            ) : hasContact && detail ? (
              <div className="space-y-3 text-sm text-foreground/80">
                {addressLines.length > 0 && (
                  <div className="flex items-start gap-2.5">
                    <SunsetIcon
                      name="map-pin"
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <address className="not-italic leading-relaxed">
                      {addressLines.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </address>
                  </div>
                )}

                {detail.phone_number?.trim() ? (
                  <div className="flex items-center gap-2.5">
                    <SunsetIcon name="phone" className="h-4 w-4 shrink-0" />
                    <a
                      href={`tel:${detail.phone_number.replace(/\s+/g, "")}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {detail.phone_number}
                    </a>
                  </div>
                ) : null}

                {detail.website?.trim() ? (
                  <div className="flex items-center gap-2.5">
                    <SunsetIcon name="globe" className="h-4 w-4 shrink-0" />
                    <a
                      href={normalizeWebsiteUrl(detail.website.trim())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {detail.website.replace(/^https?:\/\//i, "")}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : loaded?.error ? (
              <p className="text-sm text-danger">{loaded.error}</p>
            ) : (
              <p className="text-sm text-foreground/55">
                No contact details listed yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
