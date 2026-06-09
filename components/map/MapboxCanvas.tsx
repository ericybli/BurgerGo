'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Supercluster from 'supercluster';
import { loadMapbox } from '@/src/lib/mapbox/loader';
import { MAPBOX_TOKEN } from '@/src/lib/map/provider';
import type { PlaceMarker } from '@/src/lib/map/markers';
import type { DayPath } from '@/src/lib/map/types';
import { computeBounds } from '@/src/lib/map/bounds';

/**
 * Mapbox GL renderer — a drop-in alternative to GoogleMapCanvas with the SAME
 * props ({ markers, paths, onMarkerClick }), so PlanMap can swap providers
 * transparently. Markers are DOM elements (numbered, day-colored, click →
 * onMarkerClick); day routes are GeoJSON line layers; the viewport fits all
 * markers. A compact Map/Satellite toggle switches the base style. Like the
 * Google version, the map is created once and overlays are cleared+redrawn on
 * data change, and a ResizeObserver keeps it sized (full-height + fullscreen).
 */

const STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const;
type StyleId = keyof typeof STYLES;

const SAVED_COLOR = '#33677A';

/**
 * Build the DOM element for one marker. The element itself is a 0×0 anchor point
 * (so Mapbox places the geographic coordinate exactly at the origin regardless of
 * how/when it measures the node — this is what keeps the pin from drifting as you
 * zoom). The visible disc is an absolutely-positioned child centred on that origin
 * via `translate(-50%,-50%)`, so the disc centre always sits on the coordinate.
 * Day stops get a corner order-number badge and, when scheduled, a small time
 * label below the disc.
 */
function createMarkerEl(m: PlaceMarker, onClick: (id: string) => void): HTMLButtonElement {
  const isDay = m.label != null;
  const tone = m.color ?? SAVED_COLOR;
  const size = isDay ? 34 : 28;

  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', m.name);
  el.style.cssText = 'position:relative;width:0;height:0;padding:0;border:0;background:none;cursor:pointer';

  // Atlas pin: white disc, 2px day-color ring, category glyph centered.
  const disc = document.createElement('span');
  disc.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'transform:translate(-50%,-50%)',
    'box-sizing:border-box',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    `border:2px solid ${tone}`,
    'border-radius:9999px',
    'box-shadow:0 2px 6px rgba(27,31,28,0.18)',
    'line-height:1',
    `width:${size}px`,
    `height:${size}px`,
    'background-color:#fff',
    `color:${tone}`,
  ].join(';');

  const glyph = document.createElement('span');
  glyph.textContent = m.glyph;
  glyph.setAttribute('aria-hidden', 'true');
  glyph.style.cssText = 'pointer-events:none;font-size:15px;line-height:1';
  disc.appendChild(glyph);

  if (isDay) {
    // Stop-number badge: day-color disc, white number, white ring.
    const badge = document.createElement('span');
    badge.textContent = m.label;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = [
      'position:absolute',
      'top:-6px',
      'right:-6px',
      'min-width:16px',
      'height:16px',
      'padding:0 4px',
      'box-sizing:border-box',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'border-radius:9999px',
      'border:1.5px solid #fff',
      `background:${tone}`,
      'color:#fff',
      'font-size:9.5px',
      'font-weight:700',
      'line-height:1',
    ].join(';');
    disc.appendChild(badge);
  }

  el.appendChild(disc);

  if (isDay && m.scheduledTime) {
    // Time chip under the pin: white pill, hairline border, tabular ink digits.
    const time = document.createElement('span');
    time.textContent = m.scheduledTime;
    time.setAttribute('aria-hidden', 'true');
    time.style.cssText = [
      'position:absolute',
      `top:${size / 2 + 3}px`,
      'left:0',
      'transform:translateX(-50%)',
      'padding:1px 6px',
      'border-radius:6px',
      'border:1px solid #E9EBE6',
      'background:#fff',
      'color:#1B1F1C',
      'font-size:10px',
      'font-weight:700',
      'font-variant-numeric:tabular-nums',
      'line-height:1.2',
      'white-space:nowrap',
      'box-shadow:0 1px 3px rgba(27,31,28,0.12)',
    ].join(';');
    el.appendChild(time);
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(m.id);
  });
  return el;
}

/**
 * Build the DOM element for a cluster bubble — an accent-teal disc showing how
 * many pins it groups. Same 0×0-anchor trick as `createMarkerEl` so the disc
 * centres on the cluster coordinate. Tapping it asks the caller to zoom in
 * (expansion zoom).
 */
function createClusterEl(count: number, onClick: () => void): HTMLButtonElement {
  const size = count < 10 ? 34 : count < 100 ? 40 : 46;
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', `${count} places — zoom in`);
  el.style.cssText = 'position:relative;width:0;height:0;padding:0;border:0;background:none;cursor:pointer';

  const disc = document.createElement('span');
  disc.style.cssText = [
    'position:absolute', 'left:0', 'top:0', 'transform:translate(-50%,-50%)',
    'box-sizing:border-box', 'display:flex', 'align-items:center', 'justify-content:center',
    'border:2px solid #fff', 'border-radius:9999px', 'box-shadow:0 2px 6px rgba(27,31,28,0.18)',
    `width:${size}px`, `height:${size}px`, 'background-color:#33677A', 'color:#fff',
    'font-size:13px', 'font-weight:700', 'font-variant-numeric:tabular-nums', 'line-height:1',
  ].join(';');
  disc.textContent = String(count);
  el.appendChild(disc);

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

/** Leaf-point properties carried through supercluster (the original marker). */
type LeafProps = { marker: PlaceMarker };

export function MapboxCanvas({
  markers,
  paths,
  onMarkerClick,
  fitMarkers,
  cluster = true,
}: {
  markers: PlaceMarker[];
  paths: DayPath[];
  onMarkerClick: (placeId: string) => void;
  fitMarkers?: PlaceMarker[];
  /** Cluster nearby pins into count bubbles. When false, every pin renders. */
  cluster?: boolean;
}) {
  // The viewport tracks the base markers (day/saved pins); overlay toggles pass
  // the same `fitMarkers`, so the view stays put when layers turn on/off.
  const fitSet = fitMarkers ?? markers;
  const t = useTranslations('planMap');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  const mapRef = useRef<MapboxMap | null>(null);
  const markerObjsRef = useRef<MapboxMarker[]>([]);
  const layerIdsRef = useRef<string[]>([]);
  const clusterRef = useRef<Supercluster<LeafProps> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapboxRef = useRef<any>(null);

  const [styleId, setStyleId] = useState<StyleId>('streets');
  // Bumped on initial 'load' and after every 'style.load' so the overlay effect
  // re-draws markers + route layers (setStyle wipes layers; markers persist).
  const [styleReady, setStyleReady] = useState(0);

  // Effect 1: create the map once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!MAPBOX_TOKEN) return; // no token → empty container (PlanMap shows online map slot)
      let mapboxgl;
      try {
        mapboxgl = await loadMapbox();
      } catch {
        return;
      }
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      mapboxRef.current = mapboxgl;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLES.streets,
        center: [0, 0],
        zoom: 1,
        attributionControl: true,
      });
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      // Current-location control: shows the blue dot + a recenter button. It only
      // centers the map when the user taps it, so the auto-fit (places) is unaffected.
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'bottom-right',
      );
      mapRef.current = map;
      map.on('load', () => {
        if (!cancelled) setStyleReady((n) => n + 1);
      });
    })();
    return () => {
      cancelled = true;
      markerObjsRef.current.forEach((mk) => mk.remove());
      markerObjsRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Effect 2: (re)draw markers + route layers whenever data or the style changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleReady === 0) return;

    // Clear previous DOM markers.
    markerObjsRef.current.forEach((mk) => mk.remove());
    markerObjsRef.current = [];
    // Clear previous route layers/sources.
    for (const id of layerIdsRef.current) {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    }
    layerIdsRef.current = [];

    // Route polylines (under the markers).
    paths.forEach((dp, i) => {
      if (dp.path.length < 2) return;
      const id = `route-${i}`;
      map.addSource(id, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: dp.path.map((p) => [p.lng, p.lat]) },
        },
      });
      map.addLayer({
        id,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        // Solid 3px day-color route line with round caps.
        paint: {
          'line-color': dp.color,
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });
      layerIdsRef.current.push(id);
    });

    // Cluster the pins so dense areas (a packed city day, or the "All days" view)
    // collapse into count bubbles instead of a pin-pile; they break apart as you
    // zoom in. `radius` is the grouping distance in px; `maxZoom` is the last zoom
    // that still clusters — kept low (13) so pins separate once you're zoomed into
    // a neighbourhood, not still merged at street level. When the Settings toggle
    // turns clustering off, skip the index entirely and render every pin flat.
    if (cluster) {
      const index = new Supercluster<LeafProps>({ radius: 48, maxZoom: 13 });
      index.load(
        markers.map((m) => ({
          type: 'Feature' as const,
          properties: { marker: m },
          geometry: { type: 'Point' as const, coordinates: [m.position.lng, m.position.lat] },
        })),
      );
      clusterRef.current = index;
    } else {
      clusterRef.current = null;
    }
    renderMarkers();
    map.on('moveend', renderMarkers);
    return () => {
      map.off('moveend', renderMarkers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleReady, markers, paths, cluster]);

  /**
   * Draw the clusters/leaves for the current viewport. Clears the previous DOM
   * markers, queries supercluster for the map's bounds + rounded zoom, and renders
   * a count bubble per cluster (tap → zoom to its expansion zoom) or the normal
   * numbered/colored marker per unclustered leaf. Falls back to flat markers if
   * the map can't report bounds/zoom yet.
   */
  function renderMarkers() {
    const map = mapRef.current;
    if (!map) return;
    const index = clusterRef.current;

    markerObjsRef.current.forEach((mk) => mk.remove());
    markerObjsRef.current = [];

    const addMarker = (lng: number, lat: number, el: HTMLElement) => {
      const marker = new mapboxRef.current.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);
      markerObjsRef.current.push(marker);
    };

    const bounds = typeof map.getBounds === 'function' ? map.getBounds() : null;
    const zoom = typeof map.getZoom === 'function' ? map.getZoom() : null;
    if (!index || !bounds || zoom == null) {
      // Clustering off, or no viewport info yet (before first render) → draw every
      // pin flat (1:1 markers).
      for (const m of markers) addMarker(m.position.lng, m.position.lat, createMarkerEl(m, (id) => clickRef.current(id)));
      return;
    }

    const bbox: [number, number, number, number] = [
      bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
    ];
    for (const f of index.getClusters(bbox, Math.round(zoom))) {
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const props = f.properties;
      if ('cluster' in props && props.cluster) {
        const clusterId = props.cluster_id;
        addMarker(lng, lat, createClusterEl(props.point_count, () => {
          const expansionZoom = index.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: [lng, lat], zoom: expansionZoom });
        }));
      } else {
        const m = (props as LeafProps).marker;
        addMarker(lng, lat, createMarkerEl(m, (id) => clickRef.current(id)));
      }
    }
  }

  // Effect 2b: fit the viewport to the base markers ONLY (not overlay layers),
  // and only when their POSITIONS actually change (initial load, day filter).
  // We key off the positions (not the array reference) because unrelated
  // re-renders — opening a place's read card, a style toggle, a data re-fetch
  // that didn't move any pin — rebuild the marker array with the SAME positions;
  // re-fitting then would yank the user's view back. Layer toggles already pass
  // the same `fitMarkers`, so the view also stays put there.
  const lastFitKeyRef = useRef('');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleReady === 0) return;
    const key = fitSet.map((m) => `${m.position.lat},${m.position.lng}`).join('|');
    if (key === lastFitKeyRef.current) return; // positions unchanged → keep the view
    lastFitKeyRef.current = key;
    const bounds = computeBounds(fitSet.map((m) => m.position));
    if (bounds) {
      map.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { padding: 48, duration: 0, maxZoom: 15 },
      );
    }
  }, [styleReady, fitSet]);

  // Effect 3: keep the map sized to its container (full-height + fullscreen).
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => map.resize());
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [styleReady]);

  function toggleStyle() {
    const map = mapRef.current;
    if (!map) return;
    const next: StyleId = styleId === 'streets' ? 'satellite' : 'streets';
    setStyleId(next);
    map.setStyle(STYLES[next]);
    map.once('style.load', () => setStyleReady((n) => n + 1));
  }

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={t('mapAriaLabel')}
      data-testid="mapbox-canvas"
      className="absolute inset-0 h-full w-full"
    >
      <button
        type="button"
        onClick={toggleStyle}
        aria-label={t('toggleMapStyle')}
        className="absolute bottom-9 left-3 z-[2] rounded-chip bg-bg/95 px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-lift backdrop-blur"
      >
        {styleId === 'streets' ? t('styleSatellite') : t('styleMap')}
      </button>
    </div>
  );
}
