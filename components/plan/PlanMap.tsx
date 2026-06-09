'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Layers, Maximize, Minimize } from 'lucide-react';
import type { PlanBucket, DayGroup } from '@/src/lib/planUrl';
import type { LegDTO, PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { dayRouteUrl, placeUrl } from '@/src/lib/googleMapsUrl';
import type { LatLngLiteral } from '@/src/lib/map/types';
import {
  buildMarkers,
  buildSavedMarkers,
  buildRestaurantMarkers,
  type PlaceMarker,
  type RestaurantMarkerInput,
} from '@/src/lib/map/markers';
import { buildDayPaths } from '@/src/lib/map/polyline';
import { colorForGroup } from '@/src/lib/map/colors';
import { MapCanvas } from '@/components/map/MapCanvas';
import { MapLegend, type LegendEntry } from '@/components/map/MapLegend';
import { EmptyState } from '@/components/EmptyState';

export interface PlanMapProps {
  bucket: PlanBucket;
  dayGroups: DayGroup[];
  legs: LegDTO[];
  mode: TravelMode;
  visibleDates: Set<string>;
  onShowOnlyDate: (date: string) => void;
  onShowAllDays: () => void;
  onOpenDayRoute: (date: string) => void;
  onViewPlace: (placeId: string) => void;
  /** Tapping a restaurant-layer pin opens its info card (name/cuisine/address/notes). */
  onViewRestaurant: (restaurantId: string) => void;
  online: boolean;
  /** Whether to cluster nearby pins (Settings toggle); defaults to true. */
  clusterPins?: boolean;
  /** Saved-bucket places, shown as an optional teal overlay in the days view. */
  savedPlaces?: PlaceDTO[];
  /** Trip restaurants, shown as an optional amber overlay in the days view. */
  restaurants?: RestaurantMarkerInput[];
  /** Tapping a Google basemap landmark while the POI toggle is on (Google provider only). */
  onPoiClick?: (googlePlaceId: string) => void;
}

/**
 * Self-contained Plan▸Map component (spec §3.4 / RESOLUTIONS §PlanMap seam).
 * Receives everything via props — never fetches, never imports PlanClient.
 * B2's PlanClient owns dayGroups/visibleDates/handlers; B3 consumes them.
 *
 * Online: renders GoogleMapCanvas + MapLegend + per-day "Open day route" links;
 *         a pin tap routes to onViewPlace (the rich read card) — or
 *         onViewRestaurant for restaurant-layer pins.
 * Offline: renders the mascot EmptyState + each visible place as a placeUrl
 *          deep-link (constructible offline from cached coords).
 * Saved bucket: un-routed pins (no polylines, no legend).
 */
export function PlanMap({
  bucket,
  dayGroups,
  legs,
  mode,
  visibleDates,
  onShowOnlyDate,
  onShowAllDays,
  onOpenDayRoute,
  onViewPlace,
  onViewRestaurant,
  online,
  clusterPins = true,
  savedPlaces = [],
  restaurants = [],
  onPoiClick,
}: PlanMapProps) {
  const t = useTranslations('planMap');
  const tm = useTranslations('mascot');
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Secondary "Layers" menu (days bucket): overlay extra pin sets onto the map.
  const [layersOpen, setLayersOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showRestaurants, setShowRestaurants] = useState(false);
  // The per-day "Open day route" links collapse into one toggle (multi-day) so
  // they don't eat the map's vertical space; collapsed by default.
  const [routesOpen, setRoutesOpen] = useState(false);

  // Body scroll-lock + Escape while the fullscreen map overlay is open. No-op
  // until isFullscreen is true (offline/saved/tests unaffected); the toggle
  // button only renders in the online branch so it can't become true offline.
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  // --- Days bucket: filter groups to visible, build markers + polylines. ---
  const visibleDayGroups = useMemo(
    () =>
      bucket === 'days'
        ? dayGroups.filter((g) => g.date !== null && visibleDates.has(g.date!))
        : [],
    [bucket, dayGroups, visibleDates],
  );

  const dayMarkers = useMemo(
    () => visibleDayGroups.flatMap((g) => buildMarkers(g)),
    [visibleDayGroups],
  );

  const dayPaths = useMemo(
    () => (bucket === 'days' ? buildDayPaths(visibleDayGroups, legs, mode) : []),
    [bucket, visibleDayGroups, legs, mode],
  );

  // --- Saved bucket: flat un-numbered markers. ---
  const savedMarkers = useMemo(
    () =>
      bucket === 'saved'
        ? buildSavedMarkers(dayGroups.flatMap((g) => g.places))
        : [],
    [bucket, dayGroups],
  );

  // Optional overlays (days bucket only), toggled from the Layers menu:
  // saved places (teal) and restaurants (amber), layered over the day stops.
  const savedLayerMarkers = useMemo(
    () => (bucket === 'days' && showSaved ? buildSavedMarkers(savedPlaces) : []),
    [bucket, showSaved, savedPlaces],
  );

  const restaurantLayerMarkers = useMemo(
    () => (bucket === 'days' && showRestaurants ? buildRestaurantMarkers(restaurants) : []),
    [bucket, showRestaurants, restaurants],
  );

  const activeMarkers: PlaceMarker[] = useMemo(
    () =>
      bucket === 'days'
        ? [...dayMarkers, ...savedLayerMarkers, ...restaurantLayerMarkers]
        : savedMarkers,
    [bucket, dayMarkers, savedLayerMarkers, restaurantLayerMarkers, savedMarkers],
  );

  // The viewport fits only the base pins (day stops / saved bucket), so toggling
  // the saved/restaurant overlays never moves the user's current view.
  const baseMarkers: PlaceMarker[] = useMemo(
    () => (bucket === 'days' ? dayMarkers : savedMarkers),
    [bucket, dayMarkers, savedMarkers],
  );

  // Restaurant-layer marker ids → route their taps to the restaurant info card
  // (restaurants aren't in `places`, so the place lookup would find nothing).
  const restaurantMarkerIds = useMemo(
    () => new Set(restaurantLayerMarkers.map((m) => m.id)),
    [restaurantLayerMarkers],
  );

  // --- Legend (days bucket only): all day groups flagged by visibleDates. ---
  const legend: LegendEntry[] = useMemo(
    () =>
      bucket === 'days'
        ? dayGroups
            .filter((g) => g.date !== null)
            .map((g) => ({
              date: g.date!,
              dayNumber: g.dayNumber ?? 1,
              color: colorForGroup(g),
              visible: visibleDates.has(g.date!),
            }))
        : [],
    [bucket, dayGroups, visibleDates],
  );

  const allVisible =
    legend.length > 0 && legend.every((l) => l.visible);

  // --- Per-day "Open day route" deep-links. ---
  const routeLinks = useMemo(
    () =>
      bucket === 'days'
        ? visibleDayGroups
            .map((g) => {
              const pts: LatLngLiteral[] = g.places
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .filter(
                  (p): p is typeof p & { lat: number; lng: number } =>
                    typeof p.lat === 'number' && typeof p.lng === 'number',
                )
                .map((p) => ({ lat: p.lat, lng: p.lng }));
              if (pts.length === 0 || !g.date) return null;
              return {
                date: g.date,
                color: colorForGroup(g),
                url: dayRouteUrl(pts, mode),
              };
            })
            .filter(Boolean)
        : [],
    [bucket, visibleDayGroups, mode],
  ) as Array<{ date: string; color: string; url: string }>;

  // --- Offline branch. ---
  if (!online) {
    // Collect all plottable visible places as deep-links (works offline).
    const offlinePlaces = bucket === 'days'
      ? visibleDayGroups.flatMap((g) =>
          g.places
            .filter(
              (p): p is typeof p & { lat: number; lng: number } =>
                typeof p.lat === 'number' && typeof p.lng === 'number',
            )
            .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, googlePlaceId: p.googlePlaceId }))
        )
      : dayGroups
          .flatMap((g) => g.places)
          .filter(
            (p): p is typeof p & { lat: number; lng: number } =>
              typeof p.lat === 'number' && typeof p.lng === 'number',
          )
          .map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, googlePlaceId: p.googlePlaceId }));

    return (
      <div className="flex flex-col">
        <EmptyState
          mascotAlt={tm('alt')}
          headline={t('offlineHeadline')}
          subtext={t('offlineSubtext')}
        />
        {offlinePlaces.length > 0 ? (
          <ul className="space-y-2 px-4 pb-6">
            {offlinePlaces.map((p) => (
              <li key={p.id}>
                <a
                  href={placeUrl({
                    name: p.name,
                    lat: p.lat,
                    lng: p.lng,
                    googlePlaceId: p.googlePlaceId,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-card border border-line bg-bg px-4 py-3 text-label text-ink"
                >
                  <span className="truncate">{p.name}</span>
                  <span aria-hidden="true" className="ml-2 shrink-0 text-accent">↗</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  // --- Online branch. ---
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {bucket === 'days' ? (
        <div className="shrink-0">
        <MapLegend
          entries={legend}
          allVisible={allVisible}
          onSelectDay={onShowOnlyDate}
          onToggleAll={onShowAllDays}
        />
        </div>
      ) : null}

      <div
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 w-full overflow-hidden bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
            : 'relative min-h-[40dvh] w-full flex-1 overflow-hidden rounded-card'
        }
      >
        <MapCanvas
          markers={activeMarkers}
          fitMarkers={baseMarkers}
          paths={dayPaths}
          cluster={clusterPins}
          onMarkerClick={(id) =>
            restaurantMarkerIds.has(id) ? onViewRestaurant(id) : onViewPlace(id)
          }
          onPoiClick={onPoiClick}
        />

        {bucket === 'days' ? (
          <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[3]">
            <button
              type="button"
              onClick={() => setLayersOpen((v) => !v)}
              aria-label={t('layers')}
              aria-expanded={layersOpen}
              className="flex h-10 items-center gap-1.5 rounded-chip bg-bg/95 px-3 text-[12.5px] font-semibold text-ink shadow-lift backdrop-blur"
            >
              <Layers size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{t('layers')}</span>
            </button>
            {layersOpen ? (
              <div
                role="group"
                aria-label={t('layers')}
                className="mt-2 w-44 rounded-card bg-bg/95 p-1.5 shadow-lift backdrop-blur"
              >
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-control px-2 py-1.5 text-caption text-ink active:bg-surface">
                  <span>{t('layerSaved')}</span>
                  <input
                    type="checkbox"
                    checked={showSaved}
                    onChange={(e) => setShowSaved(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-control px-2 py-1.5 text-caption text-ink active:bg-surface">
                  <span>{t('layerRestaurants')}</span>
                  <input
                    type="checkbox"
                    checked={showRestaurants}
                    onChange={(e) => setShowRestaurants(e.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsFullscreen((v) => !v)}
          aria-label={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
          className="absolute right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[2] flex h-10 w-10 items-center justify-center rounded-chip bg-bg/95 text-ink shadow-lift backdrop-blur"
        >
          {isFullscreen ? (
            <Minimize size={20} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Maximize size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>

      </div>

      {bucket === 'days' && routeLinks.length > 0 ? (
        <div className="shrink-0 px-3 py-3">
          {routeLinks.length === 1 ? (
            // Single visible day → show the one link directly (collapsing it
            // would save no space).
            <a
              href={routeLinks[0]!.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.preventDefault(); onOpenDayRoute(routeLinks[0]!.date); }}
              className="flex items-center justify-center gap-2 rounded-[12px] border border-line bg-bg px-3 py-2 text-[12.5px] font-semibold text-accent active:opacity-70"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-chip" style={{ backgroundColor: routeLinks[0]!.color }} />
              {t('openDayRoute')}
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setRoutesOpen((v) => !v)}
                aria-expanded={routesOpen}
                className="flex w-full items-center justify-between gap-2 rounded-[12px] border border-line bg-bg px-3 py-2 text-[12.5px] font-semibold text-accent active:opacity-70"
              >
                <span>{t('openDayRoutes')}</span>
                <span aria-hidden="true" className="text-sub">{routesOpen ? '▾' : '▸'}</span>
              </button>
              {routesOpen ? (
                <ul className="mt-2 space-y-2">
                  {routeLinks.map((r) => (
                    <li key={r.date}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.preventDefault(); onOpenDayRoute(r.date); }}
                        className="flex items-center justify-center gap-2 rounded-[12px] border border-line bg-bg px-3 py-2 text-[12.5px] font-semibold text-accent active:opacity-70"
                      >
                        <span aria-hidden="true" className="h-2 w-2 rounded-chip" style={{ backgroundColor: r.color }} />
                        {t('openDayRoute')}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
