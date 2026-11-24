"use client";

import { LocateFixed, MapPin, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CustomScheduleFields,
  ScheduleSelector,
} from "@/components/ScheduleSelector";
import {
  scheduleFromSearchParams,
  writeScheduleToSearchParams,
  type ScheduleSelection,
} from "@/lib/filters";
import {
  fetchLocationSuggestions,
  getCurrentPosition,
  NYC_CENTER,
  reverseGeocode,
  type LocationSuggestion,
} from "@/lib/location";

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Search URL. Without a place there are no coordinates, and the list falls back to the whole city. */
export function buildSearchHref(opts: {
  searchText: string;
  place: {
    location: string;
    neighborhood: string | null;
    lat: number;
    lng: number;
    locationType: string | null;
    useGPS: boolean;
  } | null;
  schedule: ScheduleSelection;
}): string {
  const params = new URLSearchParams();
  if (opts.searchText.trim()) params.set("search", opts.searchText.trim());
  const { place } = opts;
  if (place) {
    if (place.location.trim()) params.set("location", place.location.trim());
    if (place.neighborhood) params.set("neighborhood", place.neighborhood);
    params.set("lat", String(place.lat));
    params.set("lng", String(place.lng));
    if (place.locationType) params.set("locationType", place.locationType);
    if (place.useGPS) params.set("useGPS", "true");
  } else {
    // Deliberately city-wide: keeps the bare-/search "start at my location" from kicking in.
    params.set("anywhere", "1");
  }
  writeScheduleToSearchParams(opts.schedule, params);
  const query = params.toString();
  return query ? `/search?${query}` : "/search";
}

/**
 * Search form at the top of the results list: a text search (restaurants,
 * deals, cuisines) with the "where" and "when" controls beside/below it.
 * Everything in here only edits a pending search. The URL (and so the results)
 * change only when the enter button is clicked. The parent remounts this (via
 * key) when the URL changes, so the form always starts from the current URL.
 */
export function SearchBar({
  areaCenter = null,
}: {
  /** Map center while "Search this area" is active. Null restores the searched location. */
  areaCenter?: { lat: number; lng: number } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchText, setSearchText] = useState(searchParams.get("search") ?? "");

  const [location, setLocation] = useState(
    searchParams.get("location") ?? searchParams.get("zip") ?? "",
  );
  const [lat, setLat] = useState<number | null>(
    searchParams.get("lat") ? Number(searchParams.get("lat")) : null,
  );
  const [lng, setLng] = useState<number | null>(
    searchParams.get("lng") ? Number(searchParams.get("lng")) : null,
  );
  const [locationType, setLocationType] = useState<string | null>(
    searchParams.get("locationType"),
  );
  // Shown as a pill in front of the location text (set by "Use my location").
  const [neighborhood, setNeighborhood] = useState<string | null>(
    searchParams.get("neighborhood"),
  );
  const [useGPS, setUseGPS] = useState(searchParams.get("useGPS") === "true");
  const [schedule, setSchedule] = useState<ScheduleSelection>(() =>
    scheduleFromSearchParams(searchParams),
  );

  // Sync with the map: "Search this area" shows the map center here; leaving it restores the URL's location.
  // Adjusting state during render (not in an effect) keeps this to a single pass.
  const [seenAreaCenter, setSeenAreaCenter] = useState(areaCenter);
  if (areaCenter !== seenAreaCenter) {
    setSeenAreaCenter(areaCenter);
    if (areaCenter) {
      setLocation(formatCoords(areaCenter.lat, areaCenter.lng));
      setLocationType(null);
      setUseGPS(false);
      setLat(areaCenter.lat);
      setLng(areaCenter.lng);
    } else {
      const urlLat = searchParams.get("lat");
      const urlLng = searchParams.get("lng");
      setLocation(searchParams.get("location") ?? searchParams.get("zip") ?? "");
      setNeighborhood(searchParams.get("neighborhood"));
      setLocationType(searchParams.get("locationType"));
      setUseGPS(searchParams.get("useGPS") === "true");
      setLat(urlLat ? Number(urlLat) : null);
      setLng(urlLng ? Number(urlLng) : null);
    }
  }

  // The pill always names the neighborhood of the shown coordinates, so look up the map center's name.
  // A failed lookup keeps the previous name.
  useEffect(() => {
    if (!areaCenter) return;
    let cancelled = false;
    void reverseGeocode(areaCenter.lat, areaCenter.lng)
      .then((result) => {
        if (!cancelled && result?.name) setNeighborhood(result.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [areaCenter]);

  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSuggestions = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const closeSuggestions = () => {
    cancelPendingSuggestions();
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const runSearch = (
    place: {
      label: string;
      neighborhood: string | null;
      lat: number;
      lng: number;
      locationType: string | null;
      useGPS: boolean;
    } | null,
  ) => {
    router.push(
      buildSearchHref({
        searchText,
        place: place && {
          location: place.label,
          neighborhood: place.neighborhood,
          lat: place.lat,
          lng: place.lng,
          locationType: place.locationType,
          useGPS: place.useGPS,
        },
        schedule,
      }),
    );
  };

  const handleLocationInput = (value: string) => {
    setLocation(value);
    setNeighborhood(null);
    setLocationType(null);
    setUseGPS(false);
    setLat(null);
    setLng(null);

    cancelPendingSuggestions();
    debounceRef.current = setTimeout(() => {
      void fetchLocationSuggestions(value)
        .then((items) => {
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
        })
        .catch(() => {
          setSuggestions([]);
          setShowSuggestions(false);
        });
    }, 300);
  };

  // Picking a suggestion only fills the input; it does not search.
  const selectSuggestion = (suggestion: LocationSuggestion) => {
    const [nextLng, nextLat] = suggestion.center;
    setLocation(suggestion.place_name);
    setNeighborhood(null);
    setLocationType(suggestion.location_type);
    setLat(nextLat);
    setLng(nextLng);
    setUseGPS(false);
    closeSuggestions();
  };

  // "Use my location" only fills the input; it does not search.
  const locateMe = async () => {
    setIsLocating(true);
    closeSuggestions();
    try {
      const position = await getCurrentPosition();
      const nextLat = position.coords.latitude;
      const nextLng = position.coords.longitude;
      const reversed = await reverseGeocode(nextLat, nextLng);
      // Neighborhood goes in the pill; the coordinates are the text after it.
      setNeighborhood(reversed?.name ?? null);
      setLocation(formatCoords(nextLat, nextLng));
      setLocationType(reversed?.locationType ?? "Location");
      setLat(nextLat);
      setLng(nextLng);
      setUseGPS(true);
    } catch {
      setNeighborhood(null);
      setLocation(NYC_CENTER.label);
      setLocationType(NYC_CENTER.locationType);
      setLat(NYC_CENTER.lat);
      setLng(NYC_CENTER.lng);
      setUseGPS(false);
    } finally {
      setIsLocating(false);
    }
  };

  const clearLocation = () => {
    setLocation("");
    setNeighborhood(null);
    setLocationType(null);
    setUseGPS(false);
    setLat(null);
    setLng(null);
    closeSuggestions();
  };

  const submit = () => {
    closeSuggestions();

    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      runSearch({
        label: location || "Selected location",
        neighborhood,
        lat,
        lng,
        locationType: locationType ?? "Location",
        useGPS,
      });
      return;
    }

    // No place typed: search by text (and schedule) across the whole city.
    if (!location.trim()) {
      runSearch(null);
      return;
    }

    void (async () => {
      try {
        const items = await fetchLocationSuggestions(location);
        const first = items[0];
        if (first) {
          const [nextLng, nextLat] = first.center;
          runSearch({
            label: first.place_name,
            neighborhood: null,
            lat: nextLat,
            lng: nextLng,
            locationType: first.location_type,
            useGPS: false,
          });
          return;
        }
      } catch {
        // fall through to NYC
      }
      runSearch({
        label: NYC_CENTER.label,
        neighborhood: null,
        lat: NYC_CENTER.lat,
        lng: NYC_CENTER.lng,
        locationType: NYC_CENTER.locationType,
        useGPS: false,
      });
    })();
  };

  return (
    // Container queries (@[48rem]) so the layout follows the width of the
    // list panel, which is resizable, not the width of the screen.
    <form
      role="search"
      className="@container mb-5 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* Wide: [ text | where ] [when] [enter] in one row. Narrow: the group
          (text, where stacked), then when + enter together on their own line. */}
      <div className="flex flex-col gap-2 @[48rem]:flex-row @[48rem]:items-center">
        {/* The search group: text search + location in one bordered box */}
        <div className="flex flex-col rounded-2xl border border-line bg-surface shadow-lg @[48rem]:min-w-0 @[48rem]:flex-1 @[48rem]:flex-row @[48rem]:items-center">
          {/* What */}
          {/* Text and location share the row equally (same flex share) */}
          <div className="relative flex h-12 min-w-0 items-center @[48rem]:flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50 md:left-4 md:h-5 md:w-5"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search restaurants, deals, cuisines"
              className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-foreground/45 md:pl-12 md:text-base"
              aria-label="Search restaurants, deals, or cuisines"
              autoComplete="off"
            />
            {searchText ? (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="absolute right-1 top-1/2 flex h-9 w-8 -translate-y-1/2 items-center justify-center text-foreground/50 hover:text-foreground md:right-2"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
              </button>
            ) : null}
          </div>

          <div
            aria-hidden="true"
            className="h-px w-full shrink-0 bg-line @[48rem]:h-7 @[48rem]:w-px"
          />

          {/* Where */}
          <div className="relative h-12 min-w-0 @[48rem]:flex-1">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/50 md:left-4 md:h-5 md:w-5"
              aria-hidden="true"
            />
            <div
              className={`flex h-full min-w-0 items-center gap-2 pl-10 md:pl-12 ${
                location ? "pr-20" : "pr-11"
              }`}
            >
              {neighborhood ? (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-tint-strong px-3 py-1 text-sm font-medium text-foreground">
                  {neighborhood}
                </span>
              ) : null}
              <input
                type="text"
                value={location}
                onChange={(e) => handleLocationInput(e.target.value)}
                onFocus={() => {
                  if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = setTimeout(
                    () => setShowSuggestions(false),
                    150,
                  );
                }}
                placeholder={isLocating ? "Finding location…" : "Search neighborhood"}
                className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 text-sm text-foreground outline-none placeholder:text-foreground/45 md:text-base"
                aria-label="Location"
                autoComplete="off"
              />
            </div>

            <div className="absolute right-1 top-1/2 z-20 flex -translate-y-1/2 items-center md:right-2">
              {location ? (
                <button
                  type="button"
                  onClick={clearLocation}
                  className="flex h-9 w-8 items-center justify-center text-foreground/50 hover:text-foreground"
                  aria-label="Clear location"
                >
                  <X className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void locateMe()}
                disabled={isLocating}
                className="flex h-9 w-8 items-center justify-center text-foreground/60 hover:text-foreground"
                aria-label="Use my location"
                title="Use my location"
              >
                {isLocating ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-foreground/80" />
                ) : (
                  <LocateFixed className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </button>
            </div>

            {showSuggestions && suggestions.length > 0 ? (
              <ul className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface-raised py-1 shadow-lg @[48rem]:right-auto @[48rem]:w-80">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-tint-strong"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {suggestion.text}
                        </div>
                        <div className="truncate text-xs text-foreground/55">
                          {suggestion.place_name}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-foreground/45">
                        {suggestion.location_type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

        </div>

        {/* When + enter: outside the group, and always together */}
        {/* Narrow: "when" grows with the width until it reaches ~2/3 of the way
            to the wide layout (the 28.5rem cap), then stops and the enter
            button takes all the extra width. Wide: both are natural size. */}
        <div className="flex items-center gap-2 @[48rem]:shrink-0">
          <div className="min-w-0 max-w-[32rem] flex-[1000_1_0%] @[48rem]:max-w-none @[48rem]:flex-none">
            <ScheduleSelector value={schedule} onChange={setSchedule} compact />
          </div>
          <button
            type="submit"
            disabled={isLocating}
            className="flex h-12 min-w-12 flex-[1_1_3rem] items-center justify-center rounded-2xl bg-sunset sunset-hover text-on-accent shadow-lg transition disabled:opacity-60 @[48rem]:w-12 @[48rem]:flex-none"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Custom days/times: extra inputs, shown for as long as Custom is selected */}
      {schedule.scheduleMode === "custom" ? (
        <div className="mt-2">
          <CustomScheduleFields value={schedule} onChange={setSchedule} />
        </div>
      ) : null}
    </form>
  );
}