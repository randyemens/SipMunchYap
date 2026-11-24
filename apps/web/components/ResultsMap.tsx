"use client";

import { Map as MapIcon, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { EventListItem } from "@/lib/events";

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type ResultsMapProps = {
  events: EventListItem[];
  hoveredMerchantId?: number | null;
  isUsingMapSearch?: boolean;
  showSearchThisArea?: boolean;
  /** The point distances are measured from. Drawn as a pin on the map. */
  pinCenter?: { lat: number; lng: number } | null;
  viewState: MapViewState;
  onViewStateChange?: (viewState: MapViewState) => void;
  /** When true, don't auto-fit / auto-center (restored session). */
  skipAutoFit?: boolean;
  onMapMove?: (bounds: MapBounds) => void;
  onSearchThisArea?: () => void;
};

type VenuePin = {
  merchant_id: number;
  restaurant_name: string;
  latitude: number;
  longitude: number;
};

/** One pin per merchant — several events at the same venue share a marker. */
function pinsFromEvents(events: EventListItem[]): VenuePin[] {
  // globalThis.Map — the react-map-gl `Map` import shadows the built-in.
  const byMerchant = new globalThis.Map<number, VenuePin>();
  for (const event of events) {
    if (byMerchant.has(event.merchant_id)) continue;
    const lat = Number(event.latitude);
    const lng = Number(event.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    byMerchant.set(event.merchant_id, {
      merchant_id: event.merchant_id,
      restaurant_name: event.restaurant_name,
      latitude: lat,
      longitude: lng,
    });
  }
  return [...byMerchant.values()];
}

type MapboxMapLike = {
  _removed?: boolean;
  getCanvasContainer?: () => unknown;
  getBounds: () => {
    getNorth(): number;
    getSouth(): number;
    getEast(): number;
    getWest(): number;
  } | null;
  resize: () => void;
  getStyle?: () => { layers?: Array<{ id: string; type: string }> };
  setPaintProperty?: (layerId: string, name: string, value: unknown) => void;
  easeTo: (options: object) => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options: object,
  ) => void;
};

function isLiveMap(
  map: MapboxMapLike | undefined | null,
): map is MapboxMapLike {
  if (!map) return false;
  if (map._removed) return false;
  try {
    return Boolean(map.getCanvasContainer?.());
  } catch {
    return false;
  }
}

export function ResultsMap({
  events,
  hoveredMerchantId = null,
  isUsingMapSearch = false,
  showSearchThisArea = false,
  pinCenter = null,
  viewState,
  onViewStateChange,
  skipAutoFit = false,
  onMapMove,
  onSearchThisArea,
}: ResultsMapProps) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapReadyRef = useRef(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const [mapEpoch, setMapEpoch] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasSize, setHasSize] = useState(false);

  useEffect(() => {
    mapReadyRef.current = false;
    setMapLoaded(false);
    setMapEpoch((n) => n + 1);

    return () => {
      mapReadyRef.current = false;
      setMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const ready = el.clientWidth > 0 && el.clientHeight > 0;
      setHasSize(ready);
      if (ready && mapReadyRef.current) {
        const map = mapRef.current?.getMap() as MapboxMapLike | undefined;
        if (isLiveMap(map)) map.resize();
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap() as MapboxMapLike | undefined;
    if (!isLiveMap(map)) return;
    mapReadyRef.current = true;
    setMapLoaded(true);
    map.resize();
    // Paint the map's land with the site background token instead of the stock dark gray.
    // const landColor = getComputedStyle(document.documentElement)
    //   .getPropertyValue("--background")
    //   .trim();
    // if (landColor) {
    //   for (const layer of map.getStyle?.()?.layers ?? []) {
    //     if (layer.type === "background") {
    //       map.setPaintProperty?.(layer.id, "background-color", landColor);
    //     }
    //   }
    // }
  }, []);

  useEffect(() => {
    if (skipAutoFit || !pinCenter || isUsingMapSearch || !mapLoaded) return;
    const map = mapRef.current?.getMap() as MapboxMapLike | undefined;
    if (!isLiveMap(map)) return;
    map.easeTo({
      center: [pinCenter.lng, pinCenter.lat],
      zoom: 12,
      duration: 600,
    });
  }, [pinCenter, isUsingMapSearch, mapLoaded, skipAutoFit]);

  const restaurants = useMemo(() => pinsFromEvents(events), [events]);

  const restaurantKey = useMemo(
    () =>
      restaurants
        .map((r) => r.merchant_id)
        .sort((a, b) => a - b)
        .join(","),
    [restaurants],
  );

  useEffect(() => {
    if (
      skipAutoFit ||
      !mapLoaded ||
      isUsingMapSearch ||
      restaurants.length === 0
    ) {
      return;
    }
    const map = mapRef.current?.getMap() as MapboxMapLike | undefined;
    if (!isLiveMap(map)) return;

    let minLng = restaurants[0]!.longitude;
    let maxLng = restaurants[0]!.longitude;
    let minLat = restaurants[0]!.latitude;
    let maxLat = restaurants[0]!.latitude;
    for (const r of restaurants) {
      minLng = Math.min(minLng, r.longitude);
      maxLng = Math.max(maxLng, r.longitude);
      minLat = Math.min(minLat, r.latitude);
      maxLat = Math.max(maxLat, r.latitude);
    }

    if (minLng === maxLng && minLat === maxLat) {
      map.easeTo({
        center: [minLng, minLat],
        zoom: 14,
        duration: 500,
      });
      return;
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: 48,
        maxZoom: 15,
        duration: 500,
      },
    );
  }, [restaurantKey, isUsingMapSearch, restaurants, mapLoaded, skipAutoFit]);

  const handleMoveEnd = useCallback(() => {
    const map = mapRef.current?.getMap() as MapboxMapLike | undefined;
    if (!isLiveMap(map) || !onMapMove) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    onMapMove({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [onMapMove]);

  const handleMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      onViewStateChange?.({
        longitude: evt.viewState.longitude,
        latitude: evt.viewState.latitude,
        zoom: evt.viewState.zoom,
      });
    },
    [onViewStateChange],
  );

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-tint text-sm text-foreground/60">
        Mapbox token missing (`NEXT_PUBLIC_MAPBOX_TOKEN`)
      </div>
    );
  }

  const canRenderMap = mapEpoch > 0 && hasSize;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {canRenderMap ? (
        <Map
          key={mapEpoch}
          ref={mapRef}
          {...viewState}
          onLoad={handleMapLoad}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          mapStyle="mapbox://styles/mapbox/light-v11"
          mapboxAccessToken={token}
          style={{ width: "100%", height: "100%" }}
        >
          {mapLoaded ? (
            <>
              <NavigationControl position="bottom-right" />
              {restaurants.map((restaurant) => {
                const highlighted =
                  hoveredMerchantId === restaurant.merchant_id;
                return (
                  <Marker
                    key={`${mapEpoch}-${restaurant.merchant_id}`}
                    longitude={restaurant.longitude}
                    latitude={restaurant.latitude}
                    anchor="bottom"
                    style={{ zIndex: highlighted ? 10 : 1 }}
                  >
                    <div
                      className={`rounded-full bg-sunset-dusk transition-transform ${
                        highlighted ? "h-5 w-5" : "h-3.5 w-3.5"
                      }`}
                      title={restaurant.restaurant_name}
                    />
                  </Marker>
                );
              })}
              {pinCenter ? (
                <Marker
                  longitude={pinCenter.lng}
                  latitude={pinCenter.lat}
                  anchor="bottom"
                  style={{ zIndex: 6 }}
                >
                  <MapPin
                    className="h-9 w-9 text-sunset-amber drop-shadow-lg"
                    strokeWidth={2}
                    aria-label="Distance center"
                    role="img"
                  />
                </Marker>
              ) : null}
            </>
          ) : null}
        </Map>
      ) : (
        <div className="flex h-full items-center justify-center bg-tint text-sm text-foreground/60">
          Loading map…
        </div>
      )}

      {showSearchThisArea && (
        <div className="pointer-events-none absolute right-3 top-3 z-10">
          <button
            type="button"
            onClick={onSearchThisArea}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm font-medium text-foreground shadow-md hover:bg-surface-raised"
          >
            <MapIcon className="h-4 w-4" aria-hidden="true" />
            Search this area
          </button>
        </div>
      )}
    </div>
  );
}
