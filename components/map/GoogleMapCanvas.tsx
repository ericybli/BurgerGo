'use client';

import { useEffect, useRef } from 'react';
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
 * Re-renders from prop changes rebuild overlays cleanly via the effect
 * cleanup path (visibility filtering is applied upstream in PlanMap).
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest callback without forcing a full map rebuild.
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  useEffect(() => {
    let cancelled = false;
    // Track overlays from this run so cleanup can remove them.
    const overlays: Array<{ setMap: (m: unknown) => void }> = [];

    void (async () => {
      let maps: typeof google.maps;
      try {
        maps = await loadGoogleMaps();
      } catch {
        // Offline / missing key — PlanMap shows the offline state; here we
        // simply render an empty container (spec §3.4).
        return;
      }
      if (cancelled || !containerRef.current) return;

      const allPositions = markers.map((m) => m.position);
      const bounds = computeBounds(allPositions);
      const center = bounds
        ? { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2 }
        : { lat: 0, lng: 0 };

      const map = new maps.Map(containerRef.current, {
        center,
        zoom: 12,
        disableDefaultUI: false,
        clickableIcons: false,
      });

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
        overlays.push(line as unknown as { setMap: (m: unknown) => void });
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
        overlays.push(marker as unknown as { setMap: (m: unknown) => void });
      }

      if (bounds) {
        map.fitBounds(
          new maps.LatLngBounds(
            new maps.LatLng(bounds.south, bounds.west),
            new maps.LatLng(bounds.north, bounds.east),
          ),
        );
      }
    })();

    return () => {
      cancelled = true;
      for (const o of overlays) {
        if (typeof o.setMap === 'function') o.setMap(null);
      }
    };
  }, [markers, paths]);

  return (
    <div
      ref={containerRef}
      data-testid="google-map-canvas"
      className="h-full w-full"
    />
  );
}
