import {
  MapPin,
  Star,
  Store,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackToResultsLink } from "@/components/BackToResultsLink";
import { MerchantEventsAccordion } from "@/components/MerchantEventsAccordion";
import { SunsetIcon } from "@/components/SunsetIcon";
import {
  fetchMerchant,
  formatMerchantAddress,
  getDisplayRating,
} from "@/lib/merchants";

type RestaurantPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: RestaurantPageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await fetchMerchant(slug).catch(() => null);
  if (!merchant) return { title: "Restaurant | SipMunchYap" };
  return {
    title: `${merchant.restaurant_name} | SipMunchYap`,
    description: `Happy hours at ${merchant.restaurant_name}${
      merchant.neighborhood || merchant.city
        ? ` in ${merchant.neighborhood || merchant.city}`
        : ""
    }`,
  };
}

function normalizeWebsiteUrl(website: string): string {
  if (/^https?:\/\//i.test(website)) return website;
  return `https://${website}`;
}

function RestaurantFallback() {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <section className="border-b border-line bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <div className="mb-5 h-4 w-28 animate-pulse rounded bg-tint-strong" />
          <div className="flex items-start gap-5 md:gap-7">
            <div className="h-28 w-28 shrink-0 animate-pulse rounded-2xl bg-tint-strong md:h-36 md:w-36" />
            <div className="min-w-0 flex-1 space-y-3 pt-2">
              <div className="h-9 w-2/3 max-w-md animate-pulse rounded bg-tint-strong" />
              <div className="h-5 w-40 animate-pulse rounded bg-tint-strong" />
              <div className="flex gap-2">
                <div className="h-7 w-20 animate-pulse rounded-full bg-tint-strong" />
                <div className="h-7 w-24 animate-pulse rounded-full bg-tint-strong" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 md:px-8 lg:grid-cols-3 lg:gap-8 lg:px-10 lg:py-10">
          <div className="h-64 animate-pulse rounded-2xl bg-tint lg:col-span-2" />
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl bg-tint" />
            <div className="h-40 animate-pulse rounded-2xl bg-tint" />
          </div>
        </div>
      </section>
    </main>
  );
}

async function RestaurantContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await fetchMerchant(slug).catch(() => null);
  if (!merchant) notFound();

  if (merchant.slug && /^\d+$/.test(slug) && merchant.slug !== slug) {
    redirect(`/restaurant/${merchant.slug}`);
  }

  const rating = getDisplayRating(merchant);
  const categories = merchant.merchant_categories
    .map((c) => c.categories?.name)
    .filter((name): name is string => Boolean(name));
  const addressLines = formatMerchantAddress(merchant);
  const locationLabel = [merchant.neighborhood, merchant.city]
    .filter(Boolean)
    .join(", ");
  const events = merchant.events ?? [];
  const hasContact =
    addressLines.length > 0 ||
    Boolean(merchant.phone_number?.trim()) ||
    Boolean(merchant.website?.trim());

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <section className="border-b border-line bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-10">
          <BackToResultsLink />

          <div className="flex items-start gap-5 md:gap-7">
            <div
              className={`flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl md:h-36 md:w-36 ${
                merchant.logo_url
                  ? "bg-logo-tile"
                  : "bg-gradient-to-br from-tile-start to-tile-end"
              }`}
            >
              {merchant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={merchant.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                  width={144}
                  height={144}
                />
              ) : (
                <Store className="h-12 w-12 text-accent-light" strokeWidth={1.5} />
              )}
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl lg:text-5xl">
                {merchant.restaurant_name}
              </h1>

              {(locationLabel || rating) && (
                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                  {locationLabel ? (
                    <p className="inline-flex min-w-0 items-center gap-1.5 text-base font-medium text-foreground/70 md:text-lg">
                      <MapPin
                        className="h-4 w-4 shrink-0 text-foreground/50"
                        aria-hidden="true"
                      />
                      <span>{locationLabel}</span>
                    </p>
                  ) : null}
                  {rating ? (
                    <span className="inline-flex items-center gap-1.5 text-base text-foreground/70 md:text-lg">
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

              {categories.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-full border border-line-strong bg-surface-raised px-3 py-1 text-sm font-medium text-foreground/65"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 md:px-8 lg:grid-cols-3 lg:gap-8 lg:px-10 lg:py-10">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-line bg-surface p-5 md:p-6">
              <h2 className="mb-4 text-xl font-bold text-foreground">
                Events
              </h2>

              <MerchantEventsAccordion events={events} />
            </div>
          </div>

          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-2xl border border-line bg-surface p-5 md:p-6">
              <h2 className="mb-4 text-lg font-bold text-foreground">
                Contact & location
              </h2>
              {hasContact ? (
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

                  {merchant.phone_number?.trim() ? (
                    <div className="flex items-center gap-2.5">
                      <SunsetIcon name="phone" className="h-4 w-4 shrink-0" />
                      <a
                        href={`tel:${merchant.phone_number.replace(/\s+/g, "")}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {merchant.phone_number}
                      </a>
                    </div>
                  ) : null}

                  {merchant.website?.trim() ? (
                    <div className="flex items-center gap-2.5">
                      <SunsetIcon name="globe" className="h-4 w-4 shrink-0" />
                      <a
                        href={normalizeWebsiteUrl(merchant.website.trim())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-foreground hover:underline"
                      >
                        {merchant.website.replace(/^https?:\/\//i, "")}
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-foreground/55">
                  No contact details listed yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function RestaurantPage({ params }: RestaurantPageProps) {
  return (
    <Suspense fallback={<RestaurantFallback />}>
      <RestaurantContent params={params} />
    </Suspense>
  );
}
