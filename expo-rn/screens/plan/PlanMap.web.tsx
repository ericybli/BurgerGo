/**
 * Plan map — web canvas (Google Maps JS API via react-native-web). The script
 * loads once per page (module-level loader, EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);
 * the map mounts into a plain <div> appended inside an RNW View. Pins are DOM
 * nodes hosted by OverlayView (ported from the web app's markerEl.ts +
 * GoogleMapCanvas.tsx); custom Atlas controls float over the canvas. All
 * shared behavior/state lives in screens/plan/map/.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { EmptyState } from '../../components/ui';
import { colors } from '../../lib/theme';
import type { PlanMapProps } from './PlanMap.types';
import type { MapPin, MapSeg } from './map/mapData';
import { useMapShell } from './map/useMapShell';
import { buildPinEl } from './map/markerDom';
import { EmptyMapHint } from './map/EmptyHint';
import { MapChrome } from './map/MapChrome';
import { LegChip } from './map/LegChip';
import { DayLegend } from './map/DayLegend';
import { RouteLinks } from './map/RouteLinks';
import { OfflineMap } from './map/OfflineMap';
import { PoiCard } from './map/PoiCard';
import { RestaurantCard } from './map/RestaurantCard';

export type { MapDayGroup, MapRestaurant } from './PlanMap.types';

// Literal env read (Metro inlines EXPO_PUBLIC_* only when read literally).
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

// --- Module-level script loader (one <script> per page) ----------------------

let mapsPromise: Promise<typeof google.maps> | null = null;

function loadGoogleMaps(key: string): Promise<typeof google.maps> {
  if (typeof google !== 'undefined' && google.maps?.Map) return Promise.resolve(google.maps);
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const cb = '__bgPlanMapInit';
      (window as unknown as Record<string, unknown>)[cb] = () => resolve(google.maps);
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${cb}`;
      script.async = true;
      script.onerror = () => {
        mapsPromise = null;
        reject(new Error('Google Maps failed to load'));
      };
      document.head.appendChild(script);
    });
  }
  return mapsPromise;
}

type Overlay = { setMap: (m: google.maps.Map | null) => void };

export default function PlanMap(props: PlanMapProps) {
  const shell = useMapShell(props, { poiSupported: true });
  const {
    pins,
    basePins,
    fitKey,
    segs,
    fullscreen,
    setFullscreen,
    tappedLeg,
    setTappedLeg,
    poiPlaceId,
    setPoiPlaceId,
    restaurantCard,
    setRestaurantCard,
  } = shell;

  // The RNW View hosting the map; tracked in state so the map (re)creates when
  // the host (re)mounts (e.g. offline → online).
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null);
  const hostRef = useCallback((node: unknown) => {
    setHostEl((node as HTMLElement | null) ?? null);
  }, []);

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const overlaysRef = useRef<Overlay[]>([]);
  // "My location" dot lives outside overlaysRef so redraws never clear it.
  const userDotRef = useRef<google.maps.Marker | null>(null);
  const lastFitKeyRef = useRef('');

  // Latest handlers for listeners created once per map.
  const poiEnabledRef = useRef(shell.poiEnabled);
  poiEnabledRef.current = shell.poiEnabled;
  const openPoiRef = useRef(setPoiPlaceId);
  openPoiRef.current = setPoiPlaceId;
  const mapTapRef = useRef(() => {});
  mapTapRef.current = () => {
    setTappedLeg(null);
    shell.setLayersOpen(false);
  };

  // Effect 1: create the map once per host mount.
  useEffect(() => {
    if (!hostEl || !MAPS_KEY) return;
    let cancelled = false;

    void (async () => {
      let maps: typeof google.maps;
      try {
        maps = await loadGoogleMaps(MAPS_KEY);
      } catch {
        if (!cancelled) setLoadFailed(true);
        return;
      }
      if (cancelled) return;

      const div = document.createElement('div');
      div.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      hostEl.appendChild(div);
      mapDivRef.current = div;

      const m = new maps.Map(div, {
        center: { lat: 0, lng: 0 },
        zoom: 12,
        // No native Google chrome; the app draws its own Atlas controls.
        disableDefaultUI: true,
        // Toggled at runtime by the POI button.
        clickableIcons: false,
      });
      // Basemap-POI taps (clickableIcons on): the click event carries the
      // landmark's placeId — suppress Google's info window, open our card.
      // Plain map taps dismiss the leg chip + layers menu.
      m.addListener('click', (e: google.maps.MapMouseEvent & { placeId?: string }) => {
        if (e.placeId) {
          if (!poiEnabledRef.current) return;
          e.stop();
          openPoiRef.current(e.placeId);
          return;
        }
        mapTapRef.current();
      });
      setMap(m);
    })();

    return () => {
      cancelled = true;
      for (const o of overlaysRef.current) o.setMap(null);
      overlaysRef.current = [];
      userDotRef.current?.setMap(null);
      userDotRef.current = null;
      mapDivRef.current?.remove();
      mapDivRef.current = null;
      lastFitKeyRef.current = '';
      setMap(null);
    };
  }, [hostEl]);

  // Effect 2: clear + redraw overlays whenever pins/segments change.
  useEffect(() => {
    if (!map) return;
    for (const o of overlaysRef.current) o.setMap(null);
    overlaysRef.current = [];

    // Route polylines under the pins. Walk legs render as repeated round dots
    // (strokeOpacity 0 + circle symbols); drive/transit solid. Each leg also
    // gets a WIDE invisible hit line so a finger tap reliably lands.
    for (const seg of segs) {
      if (seg.path.length < 2) continue;
      const path = seg.path.map((p) => ({ lat: p.latitude, lng: p.longitude }));
      const isWalk = seg.mode === 'walk';
      const line = new google.maps.Polyline({
        path,
        strokeColor: seg.color,
        strokeOpacity: isWalk ? 0 : 0.9,
        strokeWeight: 3,
        clickable: false,
        ...(isWalk
          ? {
              icons: [
                {
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: seg.color,
                    fillOpacity: 0.9,
                    strokeOpacity: 0,
                    scale: 1.6,
                  },
                  offset: '0',
                  repeat: '10px',
                },
              ],
            }
          : {}),
        map,
      });
      overlaysRef.current.push(line);

      const hit = new google.maps.Polyline({
        path,
        strokeColor: seg.color,
        strokeOpacity: 0.001, // invisible but clickable
        strokeWeight: 16,
        map,
      });
      hit.addListener('click', () => setTappedLeg(seg));
      overlaysRef.current.push(hit);
    }

    // Atlas pins: compound DOM hosted in an OverlayView (maps.Marker can't
    // render the disc + badge + time pill).
    for (const pin of pins) {
      overlaysRef.current.push(createPinOverlay(map, pin, shell.handlePinPress));
    }
  }, [map, pins, segs, setTappedLeg, shell.handlePinPress]);

  // Effect 3: fit the viewport to the BASE pins, only when their positions
  // change — card opens, layer toggles, resizes and refetches keep the view.
  useEffect(() => {
    if (!map || !fitKey || fitKey === lastFitKeyRef.current) return;
    lastFitKeyRef.current = fitKey;
    const bounds = new google.maps.LatLngBounds();
    for (const p of basePins) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, 48);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);

  // Effect 4: size-guarded ResizeObserver — trigger a map resize (preserving
  // center) ONLY when the container actually changes size, so overlays/cards
  // opening never refit or shift the viewport.
  useEffect(() => {
    if (!map || !hostEl || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    let lastW = hostEl.clientWidth;
    let lastH = hostEl.clientHeight;
    const ro = new ResizeObserver(() => {
      const w = hostEl.clientWidth;
      const h = hostEl.clientHeight;
      if (w === lastW && h === lastH) return; // initial observe fire / no-op
      lastW = w;
      lastH = h;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = map.getCenter();
        google.maps.event.trigger(map, 'resize');
        if (center) map.setCenter(center);
      });
    });
    ro.observe(hostEl);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map, hostEl]);

  // Map options bound to chrome state.
  useEffect(() => {
    map?.setOptions({ clickableIcons: shell.poiEnabled });
  }, [map, shell.poiEnabled]);
  useEffect(() => {
    map?.setMapTypeId(shell.satellite ? 'hybrid' : 'roadmap');
  }, [map, shell.satellite]);

  // Escape exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, setFullscreen]);

  function locate() {
    if (!map || shell.locating || !navigator.geolocation) return;
    shell.setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        shell.setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (userDotRef.current) {
          userDotRef.current.setPosition(here);
        } else {
          userDotRef.current = new google.maps.Marker({
            position: here,
            map,
            clickable: false,
            zIndex: 9999,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2.5,
            },
          });
        }
        map.panTo(here);
        const zoom = map.getZoom();
        if (typeof zoom === 'number' && zoom < 14) map.setZoom(14);
      },
      () => shell.setLocating(false), // denied/unavailable — quietly release
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  // --- Offline: deep-link list replaces the whole map. ---
  if (!props.online) {
    return <OfflineMap places={shell.offlinePlaces} />;
  }

  if (!MAPS_KEY) {
    return (
      <View style={s.fill}>
        <EmptyState
          headline="Map unavailable"
          subtext="Set EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY to show the trip map on web."
        />
      </View>
    );
  }

  const showLegend = props.bucket === 'days' && shell.legend.length > 0 && !fullscreen;

  if (loadFailed) {
    return (
      <View style={s.fill}>
        <EmptyState
          headline="Map couldn't load"
          subtext="Check your connection and the Google Maps key, then try again."
        />
      </View>
    );
  }

  return (
    <View style={s.fill}>
      {showLegend ? (
        <DayLegend
          entries={shell.legend}
          allVisible={shell.allVisible}
          onSelectDate={props.onSelectDate}
        />
      ) : null}

      <View style={fullscreen ? FULLSCREEN_STYLE : s.mapBox}>
        {/* Google owns this node's DOM (a div is appended imperatively). */}
        <View ref={hostRef} style={StyleSheet.absoluteFill} />

        {/* Online-but-empty selection: the map STAYS live (web parity — layers,
            locate, satellite and POI taps remain reachable); a floating hint
            overlays the canvas instead of replacing it. With no pins the fit
            is skipped, so the viewport simply persists. */}
        {basePins.length === 0 ? <EmptyMapHint /> : null}

        <MapChrome
          showLayers={props.bucket === 'days'}
          layersOpen={shell.layersOpen}
          onToggleLayersMenu={() => shell.setLayersOpen((v) => !v)}
          showRoutes={shell.showRoutes}
          onToggleRoutes={() => shell.setShowRoutes((v) => !v)}
          showSaved={shell.showSaved}
          onToggleSaved={() => shell.setShowSaved((v) => !v)}
          showRestaurants={shell.showRestaurants}
          onToggleRestaurants={() => shell.setShowRestaurants((v) => !v)}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen(!fullscreen)}
          satellite={shell.satellite}
          onToggleSatellite={() => shell.setSatellite((v) => !v)}
          locating={shell.locating}
          onLocate={locate}
          poiSupported
          poiEnabled={shell.poiEnabled}
          onTogglePoi={shell.togglePoi}
        />

        {tappedLeg ? <LegChip seg={tappedLeg} onClose={() => setTappedLeg(null)} /> : null}

        {poiPlaceId ? (
          <PoiCard
            key={poiPlaceId}
            placeId={poiPlaceId}
            dayGroups={props.dayGroups}
            online={props.online}
            onSavePlace={props.onPoiSavePlace}
            onAddToDay={props.onPoiAddToDay}
            onSaveRestaurant={props.onPoiSaveRestaurant}
            onClose={() => setPoiPlaceId(null)}
          />
        ) : null}

        {restaurantCard ? (
          <RestaurantCard restaurant={restaurantCard} onClose={() => setRestaurantCard(null)} />
        ) : null}
      </View>

      {props.bucket === 'days' && !fullscreen ? <RouteLinks links={shell.routeLinks} /> : null}
    </View>
  );
}

/** DOM pin hosted in an OverlayView (overlayMouseTarget keeps it tappable). */
function createPinOverlay(
  map: google.maps.Map,
  pin: MapPin,
  onPress: (pin: MapPin) => void,
): Overlay {
  const el = buildPinEl(pin, () => onPress(pin));
  el.style.position = 'absolute'; // anchored by the projection in draw()
  const overlay = new google.maps.OverlayView();
  overlay.onAdd = function onAdd() {
    this.getPanes()?.overlayMouseTarget.appendChild(el);
  };
  overlay.draw = function draw() {
    const proj = this.getProjection();
    const pt = proj?.fromLatLngToDivPixel(new google.maps.LatLng(pin.lat, pin.lng));
    if (pt) {
      el.style.left = `${pt.x}px`;
      el.style.top = `${pt.y}px`;
    }
  };
  overlay.onRemove = function onRemove() {
    el.remove();
  };
  overlay.setMap(map);
  return overlay;
}

// react-native-web supports position:'fixed' at runtime; the RN style type
// doesn't, hence the cast. Fullscreen swaps the wrapper style only — the map
// node is never remounted, and the size-guarded resize keeps the center.
const FULLSCREEN_STYLE = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  backgroundColor: colors.bg,
  overflow: 'hidden',
} as unknown as ViewStyle;

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  mapBox: { flex: 1, overflow: 'hidden', minHeight: 320 },
});
