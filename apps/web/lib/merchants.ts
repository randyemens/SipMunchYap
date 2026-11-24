export type SortBy = "default" | "highest_rated" | "most_reviewed" | "distance";

export type GoogleRating = {
  google_rating: number | null;
  google_review_count: number | null;
  google_rating_url: string | null;
  match_confidence: string | null;
};

export type MerchantCategoryLink = {
  id: string;
  categories: {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
  };
};

/** Nested on merchant detail from GET /merchants/:id */
export type MerchantEvent = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  image_url?: string | null;
  category_tags?: string[] | null;
  is_verified?: boolean;
  source_url?: string | null;
  source_label?: string | null;
  display_order: number;
  event_schedules: import("@/lib/events").EventSchedule[];
  menus: import("@/lib/events").EventMenu[];
};

export type Merchant = {
  id: number;
  restaurant_name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: string | number | null;
  longitude: string | number | null;
  logo_url: string | null;
  neighborhood: string | null;
  slug: string | null;
  sort_value?: string | number | null;
  events?: MerchantEvent[];
  merchant_categories: MerchantCategoryLink[];
  merchant_offers: { id: string; is_active: boolean; end_time: string }[];
  merchant_google_ratings: GoogleRating[];
};

export type MerchantDetail = Merchant & {
  street_address_line_2: string | null;
  phone_number: string | null;
  website: string | null;
};

export type MerchantDetailResponse = {
  data: MerchantDetail;
};

export type MerchantsResponse = {
  data: Merchant[];
  pagination: {
    limit: number;
    sortBy: SortBy;
    hasMore: boolean;
    nextCursor: string | null;
    /** Matches for the whole search. Only sent on the first page (null after that). */
    total: number | null;
  };
};

export type FetchMerchantsParams = {
  limit?: number;
  cursor?: string | null;
  sortBy?: SortBy;
  search?: string;
  /** A curated homepage carousel (rows in `carousel_merchants`). */
  carouselId?: string;
  neighborhood?: string;
  categoryIds?: string[];
  days?: number[];
  startTime?: string;
  endTime?: string;
  menuType?: "food_and_drinks" | "drinks_only";
  offers?: boolean;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
};

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

export async function fetchMerchants(
  params: FetchMerchantsParams = {},
): Promise<MerchantsResponse> {
  const url = new URL(`${getApiBase()}/merchants`);
  url.searchParams.set("limit", String(params.limit ?? 30));
  url.searchParams.set("sortBy", params.sortBy ?? "default");
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.carouselId) url.searchParams.set("carouselId", params.carouselId);
  if (params.neighborhood) {
    url.searchParams.set("neighborhood", params.neighborhood);
  }
  if (params.categoryIds?.length) {
    url.searchParams.set("categoryIds", params.categoryIds.join(","));
  }
  if (params.days?.length) {
    url.searchParams.set("days", params.days.join(","));
  }
  if (params.startTime) url.searchParams.set("startTime", params.startTime);
  if (params.endTime) url.searchParams.set("endTime", params.endTime);
  if (params.menuType) url.searchParams.set("menuType", params.menuType);
  if (params.offers) url.searchParams.set("offers", "true");
  if (params.lat != null) url.searchParams.set("lat", String(params.lat));
  if (params.lng != null) url.searchParams.set("lng", String(params.lng));
  if (params.radiusMiles != null) {
    url.searchParams.set("radiusMiles", String(params.radiusMiles));
  }
  if (params.north != null) url.searchParams.set("north", String(params.north));
  if (params.south != null) url.searchParams.set("south", String(params.south));
  if (params.east != null) url.searchParams.set("east", String(params.east));
  if (params.west != null) url.searchParams.set("west", String(params.west));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Failed to fetch merchants (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<MerchantsResponse>;
}

export function getMerchantHref(merchant: Pick<Merchant, "id" | "slug">): string {
  return `/restaurant/${merchant.slug || merchant.id}`;
}

export async function fetchMerchant(
  slugOrId: string,
): Promise<MerchantDetail | null> {
  const url = `${getApiBase()}/merchants/${encodeURIComponent(slugOrId)}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Failed to fetch merchant (${res.status})`;
    throw new Error(message);
  }
  const json = (await res.json()) as MerchantDetailResponse;
  return json.data;
}

export function formatMerchantAddress(
  merchant: Pick<
    MerchantDetail,
    | "street_address"
    | "street_address_line_2"
    | "city"
    | "state"
    | "zip_code"
  >,
): string[] {
  const lines: string[] = [];
  if (merchant.street_address?.trim()) lines.push(merchant.street_address.trim());
  if (merchant.street_address_line_2?.trim()) {
    lines.push(merchant.street_address_line_2.trim());
  }
  const cityLine = [merchant.city, merchant.state].filter(Boolean).join(", ");
  const withZip = [cityLine, merchant.zip_code].filter(Boolean).join(" ");
  if (withZip) lines.push(withZip);
  return lines;
}

export function getDisplayRating(merchant: Merchant): {
  rating: number;
  count: number | null;
  source: "google" | null;
} | null {
  const google = merchant.merchant_google_ratings?.[0];
  if (
    google?.google_rating != null &&
    google.match_confidence !== "no_match"
  ) {
    return {
      rating: google.google_rating,
      count: google.google_review_count,
      source: "google",
    };
  }
  return null;
}
