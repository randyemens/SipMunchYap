export const NYC_CENTER = {
  lat: 40.7831,
  lng: -73.9712,
  label: "New York, NY",
  locationType: "City",
} as const;

export type LocationSuggestion = {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  location_type: string;
  text: string;
};

export type RadiusOption = "walking" | "bike" | "drive" | "city";

const RADIUS_MILES: Record<RadiusOption, number> = {
  walking: 1,
  bike: 3,
  drive: 5,
  city: 25,
};

function getMapboxToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("NEXT_PUBLIC_MAPBOX_TOKEN is required");
  return token;
}

export function getRadiusMiles(option: RadiusOption): number {
  return RADIUS_MILES[option];
}

export function getSmartDefaultRadius(
  locationType: string | null,
  useGPS: boolean,
): RadiusOption {
  if (useGPS) return "walking";
  if (!locationType) return "drive";

  const normalized = locationType.toLowerCase();
  if (
    normalized.includes("city") ||
    normalized.includes("place") ||
    normalized.includes("borough")
  ) {
    return "city";
  }
  if (
    normalized.includes("neighborhood") ||
    normalized.includes("locality") ||
    normalized.includes("zip") ||
    normalized.includes("postcode")
  ) {
    return "bike";
  }
  if (
    normalized.includes("state") ||
    normalized.includes("region") ||
    normalized.includes("country")
  ) {
    return "city";
  }
  return "drive";
}

function mapLocationType(placeTypes: string[]): string {
  if (placeTypes.includes("place")) return "City";
  if (placeTypes.includes("neighborhood")) return "Neighborhood";
  if (placeTypes.includes("locality")) return "Area";
  if (placeTypes.includes("postcode")) return "ZIP Code";
  return "Location";
}

export async function fetchLocationSuggestions(
  query: string,
): Promise<LocationSuggestion[]> {
  if (query.trim().length < 2) return [];

  const token = getMapboxToken();
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "7");
  url.searchParams.set(
    "types",
    "place,postcode,locality,neighborhood",
  );
  url.searchParams.set("country", "US");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Mapbox suggestions failed (${res.status})`);
  const data = (await res.json()) as {
    features?: Array<{
      id: string;
      place_name: string;
      center: [number, number];
      place_type: string[];
      text: string;
    }>;
  };

  return (data.features ?? []).map((feature) => ({
    id: feature.id,
    place_name: feature.place_name,
    center: feature.center,
    text: feature.text,
    location_type: mapLocationType(feature.place_type ?? []),
  }));
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ label: string; name: string; locationType: string } | null> {
  const token = getMapboxToken();
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "place,locality,neighborhood,postcode");
  url.searchParams.set("country", "US");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: Array<{ place_name: string; place_type: string[]; text: string }>;
  };
  const feature = data.features?.[0];
  if (!feature) return null;
  return {
    label: feature.place_name,
    // Short name only, e.g. "Upper West Side"
    name: feature.text,
    locationType: mapLocationType(feature.place_type ?? []),
  };
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 60_000,
    });
  });
}
