'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Landmark, LocateFixed } from 'lucide-react';
import { loadGoogleMaps } from '@/src/lib/googleLoader';
import type { PlaceMarker } from '@/src/lib/map/markers';
import type { DayPath } from '@/src/lib/map/types';
import { computeBounds } from '@/src/lib/map/bounds';
import { createMarkerEl } from '@/src/lib/map/markerEl';

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
  onPoiClick,
  onLegClick,
}: {
  markers: PlaceMarker[];
  paths: DayPath[];
  onMarkerClick: (placeId: string) => void;
  fitMarkers?: PlaceMarker[];
  /** Tapping a Google basemap landmark (POI) while the POI toggle is on. */
  onPoiClick?: (googlePlaceId: string) => void;
  /** Tapping a route segment that carries leg metadata (duration chip). */
  onLegClick?: (segment: DayPath) => void;
}) {
  // Viewport tracks the base markers; overlay toggles keep the same fitSet so the
  // view doesn't move when layers turn on/off.
  const fitSet = fitMarkers ?? markers;
  const t = useTranslations('planMap');
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest callbacks without forcing a full map rebuild.
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;
  const poiClickRef = useRef(onPoiClick);
  poiClickRef.current = onPoiClick;
  const legClickRef = useRef(onLegClick);
  legClickRef.current = onLegClick;

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
  // Google-POI interaction toggle: ON → basemap landmarks are tappable (their
  // taps go to onPoiClick); OFF (default) → only the app's own pins respond.
  const [poiEnabled, setPoiEnabled] = useState(false);
  const poiEnabledRef = useRef(poiEnabled);
  poiEnabledRef.current = poiEnabled;

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
        // Toggled at runtime by the POI button (clickable landmarks).
        clickableIcons: false,
      });
      // Basemap-POI taps: with clickableIcons on, Google fires a map click
      // whose event carries the landmark's placeId. Stop Google's own info
      // window and hand the id to the app (which shows its own card).
      mapRef.current.addListener?.('click', (e: { placeId?: string; stop?: () => void }) => {
        if (!poiEnabledRef.current || !e?.placeId) return;
        e.stop?.();
        poiClickRef.current?.(e.placeId);
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

    // Polylines under the markers — solid 3px day-color route lines. Segments
    // that carry leg metadata also get a WIDE invisible hit line so a finger
    // tap reliably lands → onLegClick shows the duration/distance chip.
    for (const dp of paths) {
      if (dp.path.length < 2) continue;
      const line = new maps.Polyline({
        path: dp.path,
        strokeColor: dp.color,
        strokeOpacity: 0.9,
        strokeWeight: 3,
        clickable: false,
        map,
      });
      overlaysRef.current.push(line as unknown as { setMap: (m: unknown) => void });
      if (dp.seg) {
        const hit = new maps.Polyline({
          path: dp.path,
          strokeColor: dp.color,
          strokeOpacity: 0.001, // invisible but clickable
          strokeWeight: 16,
          map,
        });
        hit.addListener?.('click', () => legClickRef.current?.(dp));
        overlaysRef.current.push(hit as unknown as { setMap: (m: unknown) => void });
      }
    }

    // Atlas pins: the SAME DOM as the Mapbox provider (white disc + day-color
    // ring + category glyph + stop-number badge + scheduled-time chip), hosted
    // in a custom OverlayView — maps.Marker can't render compound DOM.
    for (const m of markers) {
      const el = createMarkerEl(m, (id) => clickRef.current(id));
      el.style.position = 'absolute'; // anchored by the overlay projection below
      const overlay = new maps.OverlayView();
      overlay.onAdd = function () {
        // overlayMouseTarget receives DOM events → the button stays tappable.
        this.getPanes?.()?.overlayMouseTarget?.appendChild(el);
      };
      overlay.draw = function () {
        const proj = this.getProjection?.();
        const pt = proj?.fromLatLngToDivPixel?.(new maps.LatLng(m.position.lat, m.position.lng));
        if (pt) {
          el.style.left = `${pt.x}px`;
          el.style.top = `${pt.y}px`;
        }
      };
      overlay.onRemove = function () {
        el.remove();
      };
      overlay.setMap(map);
      overlaysRef.current.push(overlay as unknown as { setMap: (m: unknown) => void });
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
  // device/orientation and the fullscreen toggle changes the container size
  // after creation; Google caches size at init, so trigger 'resize' when the
  // container ACTUALLY changes size — preserving the user's center/zoom (no
  // fitBounds: re-fitting here reset the view whenever a card opened or the
  // mobile URL bar collapsed). Observes once per map lifetime; ResizeObserver's
  // initial on-observe callback is skipped via the size guard.
  useEffect(() => {
    const el = containerRef.current;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!el || !maps || !map || typeof ResizeObserver === 'undefined') return;

    let raf = 0;
    let lastW = el.clientWidth;
    let lastH = el.clientHeight;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === lastW && h === lastH) return; // initial observe fire / no-op
      lastW = w;
      lastH = h;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = typeof map.getCenter === 'function' ? map.getCenter() : null;
        maps.event?.trigger?.(map, 'resize');
        if (center) map.setCenter?.(center);
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [mapReady]);

  /** Roadmap ↔ hybrid (satellite imagery + labels), like Mapbox's style toggle. */
  function toggleMapType() {
    const map = mapRef.current;
    if (!map) return;
    const next = mapType === 'roadmap' ? 'hybrid' : 'roadmap';
    setMapType(next);
    map.setMapTypeId?.(next);
  }

  /** Toggle whether Google basemap landmarks (POIs) respond to taps. */
  function togglePoi() {
    const next = !poiEnabled;
    setPoiEnabled(next);
    mapRef.current?.setOptions?.({ clickableIcons: next });
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
      {/* Google-POI interaction toggle (above locate): ON → basemap landmarks
          are tappable and open the app's add-to-places card. */}
      {onPoiClick ? (
        <button
          type="button"
          onClick={togglePoi}
          aria-pressed={poiEnabled}
          aria-label={t('poiToggle')}
          className={`absolute bottom-[5.5rem] right-3 z-[2] flex h-10 w-10 items-center justify-center rounded-chip shadow-lift backdrop-blur active:scale-95 ${
            poiEnabled ? 'bg-accent text-white' : 'bg-bg/95 text-ink'
          }`}
        >
          <Landmark size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
