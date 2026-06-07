'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Map as MapboxMap, Marker as MapboxMarker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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

const SAVED_COLOR = '#4F8A86';

/**
 * Build the DOM element for one marker: a colored disc (day color, or teal for
 * saved/layer pins) showing the place's category glyph. Day stops also get a
 * small numbered badge in the corner so list/map stop numbering stays legible
 * without hiding the category icon.
 */
function createMarkerEl(m: PlaceMarker, onClick: (id: string) => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', m.name);
  const isDay = m.label != null;
  const bg = m.color ?? SAVED_COLOR;
  el.style.cssText = [
    'position:relative',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
    'border:2px solid #fff',
    'border-radius:9999px',
    'box-shadow:0 1px 3px rgba(0,0,0,0.35)',
    'cursor:pointer',
    'line-height:1',
    `width:${isDay ? '30px' : '26px'}`,
    `height:${isDay ? '30px' : '26px'}`,
    `background-color:${bg}`,
  ].join(';');

  const glyph = document.createElement('span');
  glyph.textContent = m.glyph;
  glyph.setAttribute('aria-hidden', 'true');
  glyph.style.cssText = 'pointer-events:none;font-size:15px;line-height:1';
  el.appendChild(glyph);

  if (isDay) {
    const badge = document.createElement('span');
    badge.textContent = m.label;
    badge.setAttribute('aria-hidden', 'true');
    badge.style.cssText = [
      'position:absolute',
      'bottom:-8px',
      'left:50%',
      'transform:translateX(-50%)',
      'min-width:16px',
      'height:16px',
      'padding:0 4px',
      'box-sizing:border-box',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'border-radius:9999px',
      'background:#fff',
      `color:${bg}`,
      'font-size:10px',
      'font-weight:700',
      'line-height:1',
      'box-shadow:0 1px 2px rgba(0,0,0,0.3)',
    ].join(';');
    el.appendChild(badge);
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(m.id);
  });
  return el;
}

export function MapboxCanvas({
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
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  const mapRef = useRef<MapboxMap | null>(null);
  const markerObjsRef = useRef<MapboxMarker[]>([]);
  const layerIdsRef = useRef<string[]>([]);
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
        paint: { 'line-color': dp.color, 'line-width': 4, 'line-opacity': 0.9 },
      });
      layerIdsRef.current.push(id);
    });

    // Numbered/colored DOM markers.
    for (const m of markers) {
      const el = createMarkerEl(m, (id) => clickRef.current(id));
      const marker = new mapboxRef.current.Marker({ element: el, anchor: 'center' })
        .setLngLat([m.position.lng, m.position.lat])
        .addTo(map);
      markerObjsRef.current.push(marker);
    }

    // Fit the viewport to all markers.
    const bounds = computeBounds(markers.map((m) => m.position));
    if (bounds) {
      map.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { padding: 48, duration: 0, maxZoom: 15 },
      );
    }
  }, [styleReady, markers, paths]);

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
        className="absolute bottom-9 left-3 z-[2] rounded-control bg-card/95 px-3 py-1.5 text-caption font-medium text-ink shadow-card backdrop-blur"
      >
        {styleId === 'streets' ? t('styleSatellite') : t('styleMap')}
      </button>
    </div>
  );
}
