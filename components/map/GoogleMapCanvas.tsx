'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LocateFixed } from 'lucide-react';
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
  fitMarkers,
}: {
  markers: PlaceMarker[];
  paths: DayPath[];
  onMarkerClick: (placeId: string) => void;
  fitMarkers?: PlaceMarker[];
}) {
  // Viewport tracks the base markers; overlay toggles keep the same fitSet so the
  // view doesn't move when layers turn on/off.
  const fitSet = fitMarkers ?? markers;
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
  // The "my location" blue dot — kept OUT of overlaysRef so marker/path redraws
  // never clear it. eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userDotRef = useRef<any>(null);

  // Bumped to 1 when the maps.Map instance is ready, triggering the overlay effect.
  const [mapReady, setMapReady] = useState(0);
  // Roadmap ↔ hybrid (satellite + labels) toggle, mirroring MapboxCanvas's control.
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
  // True while a geolocation request is in flight (disables the locate button).
  const [locating, setLocating] = useState(false);

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
        // No native Google chrome at all (map-type dropdown, zoom, pan, Street
        // View pegman, fullscreen): the app provides its own Atlas-styled
        // controls — Layers + fullscreen in PlanMap, satellite + locate here.
        // Touch gestures (drag / pinch-zoom / double-tap) are unaffected.
        disableDefaultUI: true,
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

    // Polylines under the markers — Atlas route style: 3px dotted day-color
    // line (round dot symbols repeated along an invisible stroke).
    for (const dp of paths) {
      if (dp.path.length < 2) continue;
      const line = new maps.Polyline({
        path: dp.path,
        strokeColor: dp.color,
        strokeOpacity: 0,
        strokeWeight: 3,
        icons: [
          {
            icon: {
              path: maps.SymbolPath?.CIRCLE ?? 0,
              fillColor: dp.color,
              fillOpacity: 0.9,
              strokeOpacity: 0,
              scale: 1.5,
            },
            offset: '0',
            repeat: '9px',
          },
        ],
        map,
      });
      overlaysRef.current.push(line as unknown as { setMap: (m: unknown) => void });
    }

    // Atlas pins: white discs ringed in the day color (or accent teal for
    // saved/layer pins), labeled with the category glyph so categories are
    // distinguishable.
    for (const m of markers) {
      const marker = new maps.Marker({
        position: m.position,
        map,
        title: m.name,
        label: { text: m.glyph, fontSize: '16px' },
        icon: {
          path: maps.SymbolPath?.CIRCLE ?? 0,
          scale: m.label ? 14 : 12,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: m.color ?? '#33677A',
          strokeWeight: 2,
        },
      });
      const id = m.id;
      marker.addListener('click', () => clickRef.current(id));
      overlaysRef.current.push(marker as unknown as { setMap: (m: unknown) => void });
    }
  }, [mapReady, markers, paths]);

  // Effect 2b: center + fit the viewport to the base markers only, and only when
  // their POSITIONS change — so unrelated re-renders (opening a place's read
  // card, a data re-fetch that moved no pin, layer toggles) keep the user's view
  // instead of snapping it back to the fit.
  const lastFitKeyRef = useRef('');
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const key = fitSet.map((m) => `${m.position.lat},${m.position.lng}`).join('|');
    if (key === lastFitKeyRef.current) return; // positions unchanged → keep the view
    const bounds = computeBounds(fitSet.map((m) => m.position));
    if (!bounds) return;
    lastFitKeyRef.current = key;
    map.setCenter({
      lat: (bounds.south + bounds.north) / 2,
      lng: (bounds.west + bounds.east) / 2,
    });
    map.fitBounds(
      new maps.LatLngBounds(
        new maps.LatLng(bounds.south, bounds.west),
        new maps.LatLng(bounds.north, bounds.east),
      ),
    );
  }, [mapReady, fitSet]);

  // Effect 3: keep the map sized to its container. Flex-fill height varies per
  // device/orientation and the fullscreen toggle changes the container size after
  // creation; Google caches size at init, so we must trigger 'resize' + re-fit or
  // tiles render grey / mis-centered.
  useEffect(() => {
    const el = containerRef.current;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!el || !maps || !map || typeof ResizeObserver === 'undefined') return;

    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        maps.event?.trigger?.(map, 'resize');
        const bounds = computeBounds(fitSet.map((m) => m.position));
        if (bounds) {
          map.fitBounds(
            new maps.LatLngBounds(
              new maps.LatLng(bounds.south, bounds.west),
              new maps.LatLng(bounds.north, bounds.east),
            ),
          );
        }
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [mapReady, fitSet]);

  /** Roadmap ↔ hybrid (satellite imagery + labels), like Mapbox's style toggle. */
  function toggleMapType() {
    const map = mapRef.current;
    if (!map) return;
    const next = mapType === 'roadmap' ? 'hybrid' : 'roadmap';
    setMapType(next);
    map.setMapTypeId?.(next);
  }

  /** Center on the user's position and drop/update the blue location dot. */
  function handleLocate() {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map || locating || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (userDotRef.current) {
          userDotRef.current.setPosition?.(here);
        } else {
          userDotRef.current = new maps.Marker({
            position: here,
            map,
            clickable: false,
            zIndex: 9999,
            icon: {
              path: maps.SymbolPath?.CIRCLE ?? 0,
              scale: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2.5,
            },
          });
        }
        map.panTo?.(here);
        const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 12;
        if (typeof zoom === 'number' && zoom < 14) map.setZoom?.(14);
      },
      () => setLocating(false), // denied/unavailable — quietly release the button
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    // Wrapper owns the custom controls; Google owns (and rewrites) the inner
    // container's DOM, so React-rendered buttons must live OUTSIDE it.
    // absolute inset-0 fills the positioned parent (PlanMap wraps this in a
    // `relative` flex-fill div, or `fixed` in fullscreen). This avoids the
    // percentage-height-in-a-flex-item collapse that `h-full` hits when the
    // parent's height comes from flex-grow rather than an explicit height.
    <div className="absolute inset-0 h-full w-full">
      <div
        ref={containerRef}
        role="application"
        aria-label={t('mapAriaLabel')}
        data-testid="google-map-canvas"
        className="absolute inset-0 h-full w-full"
      />
      {/* Satellite ↔ map toggle — mirrors MapboxCanvas's control (bottom-left,
          above the Google attribution bar). */}
      <button
        type="button"
        onClick={toggleMapType}
        aria-label={t('toggleMapStyle')}
        className="absolute bottom-9 left-3 z-[2] rounded-chip bg-bg/95 px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-lift backdrop-blur"
      >
        {mapType === 'roadmap' ? t('styleSatellite') : t('styleMap')}
      </button>
      {/* Current-location button (bottom-right). */}
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        aria-label={t('locate')}
        className="absolute bottom-9 right-3 z-[2] flex h-10 w-10 items-center justify-center rounded-chip bg-bg/95 text-ink shadow-lift backdrop-blur active:scale-95 disabled:text-faint"
      >
        <LocateFixed size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
