"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildSearchHref, formatCoords } from "@/components/SearchBar";
import { NO_SCHEDULE } from "@/lib/filters";
import { getCurrentPosition, reverseGeocode } from "@/lib/location";

/**
 * Starts a bare `/search` (no query at all) at the user's location.
 * The list shows the whole city right away, then, once the browser gives a
 * position, the URL is replaced with the same GPS search the "Use my location"
 * button would run. While that's pending, a small "Finding your location…"
 * notice is shown so the change doesn't look random. Denied, unavailable or
 * slow location just leaves the city-wide list, and a search that already has
 * a query (including one where the user cleared the location) is never touched.
 */
export function InitialLocation() {
  const router = useRouter();
  const isBare = useSearchParams().toString() === "";
  const started = useRef(false);
  // Starts true on a bare load so the notice shows from the first paint.
  const [locating, setLocating] = useState(isBare);

  useEffect(() => {
    if (!isBare || started.current) return;
    started.current = true;

    void (async () => {
      try {
        // Don't re-prompt (or wait) when the user already blocked location.
        const status = await navigator.permissions?.query({ name: "geolocation" });
        if (status?.state === "denied") return;

        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;
        const reversed = await reverseGeocode(latitude, longitude).catch(() => null);

        // The user may have searched or left the page while we waited; don't override that.
        if (window.location.pathname !== "/search" || window.location.search !== "") {
          return;
        }

        router.replace(
          buildSearchHref({
            searchText: "",
            place: {
              location: formatCoords(latitude, longitude),
              neighborhood: reversed?.name ?? null,
              lat: latitude,
              lng: longitude,
              locationType: reversed?.locationType ?? "Location",
              useGPS: true,
            },
            schedule: NO_SCHEDULE,
          }),
        );
      } catch {
        // No location: stay on the city-wide list.
      } finally {
        setLocating(false);
      }
    })();
  }, [isBare, router]);

  if (!locating || !isBare) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(var(--nav-h,4rem)+1rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface-raised px-4 py-2 text-sm text-foreground shadow-lg md:bottom-6"
    >
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-foreground/80"
      />
      Finding your location…
    </div>
  );
}
