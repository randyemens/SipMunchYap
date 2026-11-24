"use client";

import { ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FilterPopup } from "@/components/FilterPopup";
import { MerchantDrawer } from "@/components/MerchantDrawer";
import { MerchantListRow } from "@/components/MerchantListRow";
import type { MapBounds, MapViewState } from "@/components/ResultsMap";
import { SearchBar } from "@/components/SearchBar";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  resolveFiltersForApi,
  scheduleFromSearchParams,
  type MerchantFilters,
} from "@/lib/filters";
import {
  getRadiusMiles,
  getSmartDefaultRadius,
  NYC_CENTER,
} from "@/lib/location";
import {
  fetchEvents,
  type EventListItem,
  type EventSortBy,
} from "@/lib/events";

const PAGE_SIZE = 30;
const LIST_WIDTH_STORAGE_KEY = "smy.listPanelWidthPct";
const MAP_HEIGHT_STORAGE_KEY = "smy.mapPanelHeightPct";
const DEFAULT_LIST_WIDTH_PCT = 50;
const MIN_LIST_WIDTH_PCT = 28;
const MAX_LIST_WIDTH_PCT = 72;
const DEFAULT_MAP_HEIGHT_PCT = 38;
const MIN_MAP_HEIGHT_PCT = 22;
const MAX_MAP_HEIGHT_PCT = 62;

const ResultsMap = dynamic(
  () =>
    import("@/components/ResultsMap").then((m) => ({ default: m.ResultsMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-tint text-sm text-foreground/60">
        Loading map…
      </div>
    ),
  },
);

function boundsEqual(a: MapBounds | null, b: MapBounds | null): boolean {
  if (!a || !b) return false;
  const eps = 1e-6;
  return (
    Math.abs(a.north - b.north) < eps &&
    Math.abs(a.south - b.south) < eps &&
    Math.abs(a.east - b.east) < eps &&
    Math.abs(a.west - b.west) < eps
  );
}

/** Distance in miles from the API's `sort_value` (only set for the distance sort). */
function boundsCenter(bounds: MapBounds): { lat: number; lng: number } {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

function distanceMilesOf(event: EventListItem): number | null {
  if (event.sort_value == null) return null;
  const miles = Number(event.sort_value);
  return Number.isFinite(miles) ? miles : null;
}

export function MerchantList() {
  const searchParams = useSearchParams();
  // The text, "where" and "when" parts of the search live in the URL.
  const searchParamsKey = searchParams.toString();
  const searchText = searchParams.get("search")?.trim() ?? "";
  const schedule = useMemo(
    () => scheduleFromSearchParams(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const locationType = searchParams.get("locationType");
  const useGPS = searchParams.get("useGPS") === "true";
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = latParam != null ? Number(latParam) : NYC_CENTER.lat;
  const lng = lngParam != null ? Number(lngParam) : NYC_CENTER.lng;
  const radiusMiles = getRadiusMiles(
    getSmartDefaultRadius(locationType, useGPS),
  );

  const [events, setEvents] = useState<EventListItem[]>([]);
  // Total matches for the whole search (from the first page), shown next to the header.
  const [total, setTotal] = useState<number | null>(null);
  // "Nearest" measures from the searched location (neighborhood, typed place, or GPS).
  // Without coordinates in the URL there is no origin, so it falls back to Highest rated.
  const hasSearchCoords =
    latParam != null &&
    lngParam != null &&
    Number.isFinite(Number(latParam)) &&
    Number.isFinite(Number(lngParam));
  // Nearest is the default.
  const [sortBy, setSortBy] = useState<EventSortBy>("distance");
  const effectiveSortBy: EventSortBy =
    sortBy === "distance" && !hasSearchCoords ? "highest_rated" : sortBy;
  // Popup filters (categories, menu type, ...) plus the URL-driven schedule.
  const [filters, setFilters] = useState<MerchantFilters>(DEFAULT_FILTERS);
  const effectiveFilters = useMemo<MerchantFilters>(
    () => ({ ...filters, ...schedule }),
    [filters, schedule],
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMerchantId, setHoveredMerchantId] = useState<number | null>(
    null,
  );
  const [selectedEvent, setSelectedEvent] = useState<EventListItem | null>(
    null,
  );

  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const [searchedBounds, setSearchedBounds] = useState<MapBounds | null>(null);
  const [isUsingMapSearch, setIsUsingMapSearch] = useState(false);
  const [hasMapMoved, setHasMapMoved] = useState(false);
  const [showSearchThisArea, setShowSearchThisArea] = useState(false);
  const [mapViewState, setMapViewState] = useState<MapViewState>({
    longitude: Number.isFinite(lng) ? lng : NYC_CENTER.lng,
    latitude: Number.isFinite(lat) ? lat : NYC_CENTER.lat,
    zoom: 12,
  });
  const [listWidthPct, setListWidthPct] = useState(DEFAULT_LIST_WIDTH_PCT);
  const [mapHeightPct, setMapHeightPct] = useState(DEFAULT_MAP_HEIGHT_PCT);
  const [isResizing, setIsResizing] = useState(false);
  const splitRef = useRef<HTMLElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedWidth = localStorage.getItem(LIST_WIDTH_STORAGE_KEY);
      if (storedWidth) {
        const parsed = Number(storedWidth);
        if (
          Number.isFinite(parsed) &&
          parsed >= MIN_LIST_WIDTH_PCT &&
          parsed <= MAX_LIST_WIDTH_PCT
        ) {
          setListWidthPct(parsed);
        }
      }
      const storedHeight = localStorage.getItem(MAP_HEIGHT_STORAGE_KEY);
      if (storedHeight) {
        const parsed = Number(storedHeight);
        if (
          Number.isFinite(parsed) &&
          parsed >= MIN_MAP_HEIGHT_PCT &&
          parsed <= MAX_MAP_HEIGHT_PCT
        ) {
          setMapHeightPct(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters],
  );

  const searchCenter = useMemo(
    () =>
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng }
        : { lat: NYC_CENTER.lat, lng: NYC_CENTER.lng },
    [lat, lng],
  );
  // Distances (and the pin) start at the searched place. After "Search this area" they move to the map center.
  const distanceOrigin = useMemo(
    () =>
      isUsingMapSearch && searchedBounds ? boundsCenter(searchedBounds) : searchCenter,
    [isUsingMapSearch, searchedBounds, searchCenter],
  );

  const loadPage = useCallback(
    async (opts: {
      cursor?: string | null;
      append: boolean;
      sort: EventSortBy;
      filters: MerchantFilters;
      search?: string;
      bounds?: MapBounds | null;
      useBounds?: boolean;
      lat?: number;
      lng?: number;
      radiusMiles?: number;
    }) => {
      if (opts.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const resolved = resolveFiltersForApi(opts.filters);
        const res = await fetchEvents({
          limit: PAGE_SIZE,
          cursor: opts.cursor ?? null,
          sortBy: opts.sort,
          ...(opts.search ? { search: opts.search } : {}),
          ...resolved,
          ...(opts.useBounds && opts.bounds
            ? {
                north: opts.bounds.north,
                south: opts.bounds.south,
                east: opts.bounds.east,
                west: opts.bounds.west,
              }
            : opts.lat != null && opts.lng != null && opts.radiusMiles != null
              ? {
                  lat: opts.lat,
                  lng: opts.lng,
                  radiusMiles: opts.radiusMiles,
                }
              : {}),
          // Distance sort measures from the search origin, even when results are limited to the map area.
          ...(opts.sort === "distance" && opts.useBounds && opts.lat != null && opts.lng != null
            ? { lat: opts.lat, lng: opts.lng }
            : {}),
        });
        setEvents((prev) => (opts.append ? [...prev, ...res.data] : res.data));
        if (!opts.append) setTotal(res.pagination.total);
        setNextCursor(res.pagination.nextCursor);
        setHasMore(res.pagination.hasMore);
        if (!opts.append && listScrollRef.current) {
          listScrollRef.current.scrollTop = 0;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
        if (!opts.append) setEvents([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Filter/sort/location/search changes leave map-search mode and close the drawer
    setIsUsingMapSearch(false);
    setSearchedBounds(null);
    setShowSearchThisArea(false);
    setHasMapMoved(false);
    setSelectedEvent(null);
    void loadPage({
      append: false,
      sort: effectiveSortBy,
      filters: effectiveFilters,
      search: searchText,
      cursor: null,
      useBounds: false,
      lat: searchCenter.lat,
      lng: searchCenter.lng,
      radiusMiles,
    });
  }, [
    effectiveSortBy,
    effectiveFilters,
    searchText,
    loadPage,
    searchCenter.lat,
    searchCenter.lng,
    radiusMiles,
  ]);

  const handleMapMove = useCallback(
    (bounds: MapBounds) => {
      setMapBounds(bounds);
      if (!hasMapMoved) {
        setHasMapMoved(true);
        setShowSearchThisArea(true);
        return;
      }
      if (isUsingMapSearch && !boundsEqual(bounds, searchedBounds)) {
        setShowSearchThisArea(true);
      }
    },
    [hasMapMoved, isUsingMapSearch, searchedBounds],
  );

  const handleSearchThisArea = useCallback(() => {
    if (!mapBounds) return;
    const origin = boundsCenter(mapBounds);
    setSearchedBounds(mapBounds);
    setIsUsingMapSearch(true);
    setShowSearchThisArea(false);
    void loadPage({
      append: false,
      sort: effectiveSortBy,
      filters: effectiveFilters,
      search: searchText,
      cursor: null,
      bounds: mapBounds,
      useBounds: true,
      lat: origin.lat,
      lng: origin.lng,
    });
  }, [mapBounds, effectiveSortBy, effectiveFilters, searchText, loadPage]);

  const clampListWidth = useCallback((pct: number) => {
    return Math.min(MAX_LIST_WIDTH_PCT, Math.max(MIN_LIST_WIDTH_PCT, pct));
  }, []);

  const clampMapHeight = useCallback((pct: number) => {
    return Math.min(MAX_MAP_HEIGHT_PCT, Math.max(MIN_MAP_HEIGHT_PCT, pct));
  }, []);

  const persistListWidth = useCallback(
    (pct: number) => {
      const clamped = clampListWidth(pct);
      try {
        localStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
      return clamped;
    },
    [clampListWidth],
  );

  const persistMapHeight = useCallback(
    (pct: number) => {
      const clamped = clampMapHeight(pct);
      try {
        localStorage.setItem(MAP_HEIGHT_STORAGE_KEY, String(clamped));
      } catch {
        // ignore
      }
      return clamped;
    },
    [clampMapHeight],
  );

  const onHorizontalResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const splitEl = splitRef.current;
      if (!splitEl) return;

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      setIsResizing(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const rect = splitEl.getBoundingClientRect();
        if (rect.width <= 0) return;
        const nextPct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        setListWidthPct(clampListWidth(nextPct));
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onPointerUp);
        handle.removeEventListener("pointercancel", onPointerUp);
        setIsResizing(false);
        setListWidthPct((current) => persistListWidth(current));
      };

      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerUp);
    },
    [clampListWidth, persistListWidth],
  );

  const onVerticalResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const splitEl = splitRef.current;
      if (!splitEl) return;

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      setIsResizing(true);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const rect = splitEl.getBoundingClientRect();
        if (rect.height <= 0) return;
        const nextPct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
        setMapHeightPct(clampMapHeight(nextPct));
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener("pointermove", onPointerMove);
        handle.removeEventListener("pointerup", onPointerUp);
        handle.removeEventListener("pointercancel", onPointerUp);
        setIsResizing(false);
        setMapHeightPct((current) => persistMapHeight(current));
      };

      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", onPointerUp);
      handle.addEventListener("pointercancel", onPointerUp);
    },
    [clampMapHeight, persistMapHeight],
  );

  const mapPanel = (
    <ResultsMap
      events={events}
      hoveredMerchantId={
        hoveredMerchantId ?? selectedEvent?.merchant_id ?? null
      }
      isUsingMapSearch={isUsingMapSearch}
      showSearchThisArea={showSearchThisArea}
      pinCenter={distanceOrigin}
      viewState={mapViewState}
      onViewStateChange={setMapViewState}
      onMapMove={handleMapMove}
      onSearchThisArea={handleSearchThisArea}
    />
  );

  const listPanel = (
    <>
      {/* Remounts when the URL changes so the form always starts from the current search. */}
      <SearchBar
        key={searchParamsKey}
        areaCenter={isUsingMapSearch ? distanceOrigin : null}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-3">
        <h1 className="text-lg font-semibold text-foreground/60">
          {total != null
            ? `${total} ${total === 1 ? "Happy Hour" : "Happy Hours"}`
            : "Happy Hours"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            Sort
            <span className="relative inline-flex">
              <select
                className="h-9 appearance-none rounded-xl border border-line-strong bg-surface-raised py-0 pl-3 pr-10 text-sm text-foreground"
                value={effectiveSortBy}
                onChange={(e) => setSortBy(e.target.value as EventSortBy)}
              >
                <option value="default">Name</option>
                <option value="highest_rated">Highest rated</option>
                <option value="most_reviewed">Most reviewed</option>
                <option value="relevance" disabled={!searchText}>
                  {searchText ? "Best match" : "Best match (enter a search)"}
                </option>
                <option value="distance" disabled={!hasSearchCoords}>
                  {hasSearchCoords ? "Nearest" : "Nearest (search a location)"}
                </option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50"
                aria-hidden="true"
              />
            </span>
          </label>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-surface-raised text-foreground hover:bg-tint-strong"
            aria-label="Filters"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sunset px-1 text-[11px] font-semibold text-on-accent">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <p className="py-8 text-sm text-foreground/60">Loading events…</p>
      )}

      {!loading && error && (
        <p className="py-8 text-sm text-danger">{error}</p>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="py-8 text-sm text-foreground/60">No events found.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="border-t border-line">
          {events.map((event) => (
            <MerchantListRow
              key={event.id}
              event={event}
              selected={selectedEvent?.id === event.id}
              onHover={setHoveredMerchantId}
              onSelect={setSelectedEvent}
              distanceMiles={
                effectiveSortBy === "distance" ? distanceMilesOf(event) : null
              }
            />
          ))}
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="pt-6 pb-4">
          <button
            type="button"
            className="rounded-xl border border-line-strong bg-surface-raised px-4 py-2 text-sm font-medium text-foreground hover:bg-tint-strong disabled:opacity-50"
            disabled={loadingMore || !nextCursor}
            onClick={() =>
              void loadPage({
                append: true,
                sort: effectiveSortBy,
                filters: effectiveFilters,
                search: searchText,
                cursor: nextCursor,
                bounds: searchedBounds,
                useBounds: isUsingMapSearch,
                lat: distanceOrigin.lat,
                lng: distanceOrigin.lng,
                radiusMiles,
              })
            }
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );

  return (
    <section
      ref={splitRef}
      className={`relative flex min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row ${
        isResizing ? "select-none" : ""
      }`}
      style={
        {
          ["--list-width"]: `${listWidthPct}%`,
          ["--map-height"]: `${mapHeightPct}%`,
        } as CSSProperties
      }
    >
      {/* Map: top on mobile, right on desktop */}
      <div className="relative order-1 h-[var(--map-height)] shrink-0 md:order-3 md:h-auto md:min-h-0 md:flex-1">
        {mapPanel}
      </div>

      {/* Mobile vertical resize handle */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize map and list"
        aria-valuemin={MIN_MAP_HEIGHT_PCT}
        aria-valuemax={MAX_MAP_HEIGHT_PCT}
        aria-valuenow={Math.round(mapHeightPct)}
        tabIndex={0}
        onPointerDown={onVerticalResizePointerDown}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          setMapHeightPct((current) => {
            const delta = event.key === "ArrowUp" ? -2 : 2;
            return persistMapHeight(current + delta);
          });
        }}
        className="order-2 z-10 flex h-4 shrink-0 cursor-row-resize touch-none items-center justify-center bg-background md:hidden"
      >
        <div
          className={`h-1.5 w-12 rounded-full transition-colors ${
            isResizing ? "bg-accent" : "bg-line-strong"
          }`}
        />
      </div>

      {/* Desktop horizontal resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize list and map"
        aria-valuemin={MIN_LIST_WIDTH_PCT}
        aria-valuemax={MAX_LIST_WIDTH_PCT}
        aria-valuenow={Math.round(listWidthPct)}
        tabIndex={0}
        onPointerDown={onHorizontalResizePointerDown}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          setListWidthPct((current) => {
            const delta = event.key === "ArrowLeft" ? -2 : 2;
            return persistListWidth(current + delta);
          });
        }}
        className="relative z-10 order-2 hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-transparent md:block"
      >
        <div
          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
            isResizing ? "bg-accent" : "bg-line-strong hover:bg-accent-light"
          }`}
        />
      </div>

      {/* List: bottom on mobile, left on desktop — shadow casts onto the map */}
      <div
        ref={listScrollRef}
        className="relative z-20 order-3 flex min-h-0 flex-1 flex-col overflow-y-auto bg-background px-4 py-4 shadow-[0_-8px_24px_var(--shadow-panel)] md:order-1 md:w-[var(--list-width)] md:flex-none md:px-6 md:py-6 md:shadow-[8px_0_24px_var(--shadow-panel)]"
      >
        {listPanel}
      </div>

      <MerchantDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      <FilterPopup
        open={filterOpen}
        initialFilters={filters}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFilterOpen(false);
        }}
      />
    </section>
  );
}
