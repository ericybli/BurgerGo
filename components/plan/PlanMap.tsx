'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlanBucket, DayGroup } from '@/src/lib/planUrl';
import type { LegDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { dayRouteUrl, placeUrl } from '@/src/lib/googleMapsUrl';
import type { LatLngLiteral } from '@/src/lib/map/types';
import { buildMarkers, buildSavedMarkers, type PlaceMarker } from '@/src/lib/map/markers';
import { buildDayPaths } from '@/src/lib/map/polyline';
import { colorForGroup } from '@/src/lib/map/colors';
import { GoogleMapCanvas } from '@/components/map/GoogleMapCanvas';
import { MapLegend, type LegendEntry } from '@/components/map/MapLegend';
import { PlaceInfoCard } from '@/components/map/PlaceInfoCard';
import { EmptyState } from '@/components/EmptyState';

export interface PlanMapProps {
  bucket: PlanBucket;
  dayGroups: DayGroup[];
  legs: LegDTO[];
  mode: TravelMode;
  visibleDates: Set<string>;
  onToggleDate: (date: string) => void;
  onSelectPlace: (placeId: string) => void;
  onOpenDayRoute: (date: string) => void;
  online: boolean;
}

/**
 * Self-contained Plan▸Map component (spec §3.4 / RESOLUTIONS §PlanMap seam).
 * Receives everything via props — never fetches, never imports PlanClient.
 * B2's PlanClient owns dayGroups/visibleDates/handlers; B3 consumes them.
 *
 * Online: renders GoogleMapCanvas + MapLegend + per-day "Open day route" links
 *         + PlaceInfoCard on pin tap.
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
  onToggleDate,
  onSelectPlace,
  onOpenDayRoute,
  online,
}: PlanMapProps) {
  const t = useTranslations('planMap');
  const tm = useTranslations('mascot');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    () => (bucket === 'days' ? buildDayPaths(visibleDayGroups, legs) : []),
    [bucket, visibleDayGroups, legs],
  );

  // --- Saved bucket: flat un-numbered markers. ---
  const savedMarkers = useMemo(
    () =>
      bucket === 'saved'
        ? buildSavedMarkers(dayGroups.flatMap((g) => g.places))
        : [],
    [bucket, dayGroups],
  );

  const activeMarkers: PlaceMarker[] = bucket === 'days' ? dayMarkers : savedMarkers;

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

  // --- Marker id → place lookup for the info card. ---
  const markerById = useMemo(() => {
    const m = new Map<string, PlaceMarker>();
    for (const mk of activeMarkers) m.set(mk.id, mk);
    return m;
  }, [activeMarkers]);

  const selectedMarker = selectedId ? (markerById.get(selectedId) ?? null) : null;

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
                  className="flex items-center justify-between rounded-card bg-card px-4 py-3 text-label text-ink shadow-card"
                >
                  <span className="truncate">{p.name}</span>
                  <span aria-hidden="true" className="ml-2 shrink-0 text-teal">↗</span>
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
    <div className="flex flex-col">
      {bucket === 'days' ? (
        <MapLegend
          entries={legend}
          allVisible={allVisible}
          onToggleDay={onToggleDate}
          onToggleAll={() => {
            // When all are visible, hide all; when any are hidden, show all.
            const allDates = dayGroups
              .filter((g) => g.date !== null)
              .map((g) => g.date!);
            if (allVisible) {
              allDates.forEach((d) => {
                if (visibleDates.has(d)) onToggleDate(d);
              });
            } else {
              allDates.forEach((d) => {
                if (!visibleDates.has(d)) onToggleDate(d);
              });
            }
          }}
        />
      ) : null}

      <div className="relative h-[52vh] w-full overflow-hidden rounded-card">
        <GoogleMapCanvas
          markers={activeMarkers}
          paths={dayPaths}
          onMarkerClick={(id) => setSelectedId(id)}
        />

        {selectedMarker ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
            <PlaceInfoCard
              marker={selectedMarker}
              bucket={bucket}
              onClose={() => setSelectedId(null)}
              onSelectPlace={(id) => {
                onSelectPlace(id);
                setSelectedId(null);
              }}
            />
          </div>
        ) : null}
      </div>

      {bucket === 'days' && routeLinks.length > 0 ? (
        <ul className="space-y-2 px-3 py-3">
          {routeLinks.map((r) => (
            <li key={r.date}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenDayRoute(r.date);
                  window.open(r.url, '_blank', 'noopener,noreferrer');
                }}
                className="flex items-center gap-2 rounded-control border border-line bg-card px-3 py-2 text-caption font-medium text-teal"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-chip"
                  style={{ backgroundColor: r.color }}
                />
                {t('openDayRoute')}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
