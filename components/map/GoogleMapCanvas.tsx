'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { loadGoogleMaps } from '@/src/lib/googleLoader';
import type { PlaceMarker } from '@/src/lib/map/markers';
import type { DayPath } from '@/src/lib/map/types';
import { computeBounds } from '@/src/lib/map/bounds';

/**
 * Thin imperative Google Maps JS renderer (spec §3.4). Given the prepared
 * marker list + colored day paths (from B3's pure helpers), creates numbered
 * colored markers, route polylines, and fits the viewport. All data-prep is
 * in the pure helpers; this file only translates to google.maps objects so
 * the test drives it with a fake maps namespace via a mocked loader.
 *
 * The maps.Map instance is created ONCE (on mount / after loader resolves).
 * Overlay changes (markers/polylines) clear the previous set and redraw on
 * the existing map — no white flash on visibility toggles.
 */
export function GoogleMapCanvas({
  markers,
  paths,
  onMarkerClick,
}: {
  markers: PlaceMarker[];
  paths: DayPath[];
  onMarkerClick: (placeId: string) => void;
}) {
  const t = useTranslations('planMap');
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest callback without forcing a full map rebuild.
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapsRef = useRef<any>(null);
  const overlaysRef = useRef<Array<{ setMap: (m: unknown) => void }>>([]);

  // Bumped to 1 when the maps.Map instance is ready, triggering the overlay effect.
  const [mapReady, setMapReady] = useState(0);

  // Effect 1: load the API and create the maps.Map instance once.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let maps: any;
      try {
        maps = await loadGoogleMaps();
      } catch {
        // Offline / missing key — PlanMap shows the offline state; here we
        // simply render an empty container (spec §3.4).
        return;
      }
      if (cancelled || !containerRef.current) return;

      mapsRef.current = maps;
      mapRef.current = new maps.Map(containerRef.current, {
        center: { lat: 0, lng: 0 },
        zoom: 12,
        disableDefaultUI: false,
        clickableIcons: false,
      });
      // Signal that overlays can now be drawn.
      setMapReady((n) => n + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Effect 2: clear previous overlays and redraw whenever markers/paths change
  // (or once the map first becomes ready via mapReady).
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    // Clear previous overlays.
    for (const o of overlaysRef.current) {
      if (typeof o.setMap === 'function') o.setMap(null);
    }
    overlaysRef.current = [];

    const allPositions = markers.map((m) => m.position);
    const bounds = computeBounds(allPositions);
    const center = bounds
      ? { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 }
      : { lat: 0, lng: 0 };

    map.setCenter(center);

    // Polylines under the markers.
    for (const dp of paths) {
      if (dp.path.length < 2) continue;
      const line = new maps.Polyline({
        path: dp.path,
        strokeColor: dp.color,
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
      overlaysRef.current.push(line as unknown as { setMap: (m: unknown) => void });
    }

    // Numbered, colored markers (Coral label text, spec §3.4).
    for (const m of markers) {
      const marker = new maps.Marker({
        position: m.position,
        map,
        title: m.name,
        label: m.label
          ? { text: m.label, color: '#FFFFFF', fontSize: '12px', fontWeight: '700' }
          : undefined,
        icon: {
          path: maps.SymbolPath?.CIRCLE ?? 0,
          scale: m.label ? 12 : 9,
          fillColor: m.color ?? '#4F8A86',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
      const id = m.id;
      marker.addListener('click', () => clickRef.current(id));
      overlaysRef.current.push(marker as unknown as { setMap: (m: unknown) => void });
    }

    if (bounds) {
      map.fitBounds(
        new maps.LatLngBounds(
          new maps.LatLng(bounds.south, bounds.west),
          new maps.LatLng(bounds.north, bounds.east),
        ),
      );
    }
  }, [mapReady, markers, paths]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={t('mapAriaLabel')}
      data-testid="google-map-canvas"
      className="h-full w-full"
    />
  );
}
