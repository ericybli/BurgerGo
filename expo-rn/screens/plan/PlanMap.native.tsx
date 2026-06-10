/**
 * Plan map — native canvas (react-native-maps, Apple Maps in Expo Go via
 * PROVIDER_DEFAULT). All behavior/state lives in the shared map/ pieces; this
 * file only translates pins/segments into Marker/Polyline children and owns
 * the imperative viewport (fit-once-per-position-change, locate, fullscreen
 * style swap — the MapView is never remounted).
 */
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors } from '../../lib/theme';
import { regionForCoords, type LatLng } from '../../lib/legView';
import type { PlanMapProps } from './PlanMap.types';
import { type MapPin, type MapSeg } from './map/mapData';
import { useMapShell } from './map/useMapShell';
import { PinView } from './map/Pin';
import { EmptyMapHint } from './map/EmptyHint';
import { MapChrome } from './map/MapChrome';
import { LegChip } from './map/LegChip';
import { DayLegend } from './map/DayLegend';
import { RouteLinks } from './map/RouteLinks';
import { OfflineMap } from './map/OfflineMap';
import { PoiCard } from './map/PoiCard';
import { RestaurantCard } from './map/RestaurantCard';

export type { MapDayGroup, MapRestaurant } from './PlanMap.types';

// onPoiClick is a Google-provider feature; with PROVIDER_DEFAULT that means
// Android (Google Maps) yes, iOS Expo Go (Apple Maps) no — hide the toggle.
const POI_SUPPORTED = Platform.OS === 'android';

const EDGE_PADDING = { top: 64, right: 48, bottom: 64, left: 48 };

export default function PlanMap(props: PlanMapProps) {
  const shell = useMapShell(props, { poiSupported: POI_SUPPORTED });
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastFitKeyRef = useRef('');
  const lastRegionRef = useRef<Region | null>(null);
  // Ignore the synthetic map press that some platforms fire right after an
  // overlay (leg) press, so the chip isn't cleared as soon as it opens.
  const legTapAtRef = useRef(0);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);

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

  // Fit ONLY when the base-pin positions actually change; layer toggles, card
  // opens, and fullscreen never refit.
  useEffect(() => {
    if (!mapReady || !fitKey || fitKey === lastFitKeyRef.current) return;
    lastFitKeyRef.current = fitKey;
    mapRef.current?.fitToCoordinates(
      basePins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: EDGE_PADDING, animated: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, fitKey]);

  // Android back exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      return true;
    });
    return () => sub.remove();
  }, [fullscreen, setFullscreen]);

  async function locate() {
    if (shell.locating) return;
    shell.setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return; // denied → quietly release the button
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserLoc(here);
      // Pan to the fix; raise zoom to ≈14 (delta 0.02) only if currently lower.
      const cur = lastRegionRef.current;
      const delta = Math.min(cur?.latitudeDelta ?? 0.02, 0.02);
      mapRef.current?.animateToRegion(
        { ...here, latitudeDelta: delta, longitudeDelta: delta },
        350,
      );
    } catch {
      // position unavailable — nothing to do
    } finally {
      shell.setLocating(false);
    }
  }

  // --- Offline: deep-link list replaces the whole map. ---
  if (!props.online) {
    return <OfflineMap places={shell.offlinePlaces} />;
  }

  const showLegend = props.bucket === 'days' && shell.legend.length > 0 && !fullscreen;

  // Online-but-empty selection: the map STAYS live (web parity — layers,
  // locate, satellite and POI taps remain reachable); a floating hint overlays
  // the canvas instead of replacing it. With no pins the fit is skipped, so
  // the viewport simply persists.
  const initialRegion =
    regionForCoords(basePins.map((p) => ({ latitude: p.lat, longitude: p.lng }))) ?? undefined;

  // The whole map block (canvas + floating chrome + cards). Rendered inline
  // normally; inside a true full-screen Modal when fullscreen (a Modal is the
  // only way to cover the day strip/tab bar). The MapView remounts on toggle,
  // so initialRegion comes from the last tracked region — viewport preserved.
  const mapBlock = (
      <View style={s.mapBox}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          mapType={shell.satellite ? 'hybrid' : 'standard'}
          initialRegion={lastRegionRef.current ?? initialRegion}
          onMapReady={() => setMapReady(true)}
          onRegionChangeComplete={(r) => {
            lastRegionRef.current = r;
          }}
          onPress={() => {
            if (Date.now() - legTapAtRef.current < 400) return;
            setTappedLeg(null);
            shell.setLayersOpen(false);
          }}
          onPoiClick={(e) => {
            if (!POI_SUPPORTED || !shell.poiEnabled) return;
            const id = e.nativeEvent.placeId;
            if (id) setPoiPlaceId(id);
          }}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {segs.flatMap((seg) => segPolylines(seg, (tapped) => {
            legTapAtRef.current = Date.now();
            setTappedLeg(tapped);
          }))}
          {pins.map((pin) => (
            <NativePin key={pin.key} pin={pin} onPress={() => shell.handlePinPress(pin)} />
          ))}
          {userLoc ? (
            <Marker coordinate={userLoc} anchor={{ x: 0.5, y: 0.5 }} zIndex={9999}>
              <View style={s.blueDotRing}>
                <View style={s.blueDot} />
              </View>
            </Marker>
          ) : null}
        </MapView>

        {basePins.length === 0 ? <EmptyMapHint /> : null}

        <MapChrome
          showLayers={props.bucket === 'days'}
          layersOpen={shell.layersOpen}
          onToggleLayersMenu={() => shell.setLayersOpen((v) => !v)}
          showSaved={shell.showSaved}
          onToggleSaved={() => shell.setShowSaved((v) => !v)}
          showRestaurants={shell.showRestaurants}
          onToggleRestaurants={() => shell.setShowRestaurants((v) => !v)}
          fullscreen={fullscreen}
          onToggleFullscreen={() => setFullscreen(!fullscreen)}
          satellite={shell.satellite}
          onToggleSatellite={() => shell.setSatellite((v) => !v)}
          locating={shell.locating}
          onLocate={() => void locate()}
          poiSupported={POI_SUPPORTED}
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
  );

  return (
    <View style={s.fill}>
      {showLegend ? (
        <DayLegend
          entries={shell.legend}
          allVisible={shell.allVisible}
          onSelectDate={props.onSelectDate}
        />
      ) : null}

      {fullscreen ? <View style={s.mapBox} /> : mapBlock}

      <Modal
        visible={fullscreen}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={[s.fullscreenRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {fullscreen ? mapBlock : null}
        </View>
      </Modal>

      {props.bucket === 'days' && !fullscreen ? <RouteLinks links={shell.routeLinks} /> : null}
    </View>
  );
}

/**
 * Visible route line + a wide invisible hit line per leg. Walk legs are dotted
 * (round dash); drive/transit solid. react-native-maps requires Polyline
 * elements as direct MapView children, so this returns a flat array.
 */
function segPolylines(seg: MapSeg, onPress: (seg: MapSeg) => void) {
  const isWalk = seg.mode === 'walk';
  return [
    <Polyline
      key={seg.key}
      coordinates={seg.path}
      strokeColor={seg.color}
      strokeWidth={3}
      lineCap="round"
      lineDashPattern={isWalk ? [1, 8] : undefined}
    />,
    <Polyline
      key={`${seg.key}-hit`}
      coordinates={seg.path}
      strokeColor="rgba(0,0,0,0.002)"
      strokeWidth={16}
      tappable
      onPress={() => onPress(seg)}
    />,
  ];
}

/**
 * Marker wrapper: anchors the pin disc center on the coordinate and stops
 * tracking view changes shortly after render (perf) — long enough for the
 * emoji glyph/badge to have rendered into the marker snapshot. Tracking is
 * RE-ARMED whenever the rendered pin content changes (badge number after a
 * reorder, time pill, day color, glyph), otherwise react-native-maps keeps
 * the stale marker bitmap (pin keys are stable per place, so no remount).
 */
function NativePin({ pin, onPress }: { pin: MapPin; onPress: () => void }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 700);
    return () => clearTimeout(t);
  }, [pin.label, pin.scheduledTime, pin.color, pin.glyph]);
  return (
    <Marker
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={onPress}
    >
      <PinView pin={pin} />
    </Marker>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  mapBox: { flex: 1, overflow: 'hidden' },
  fullscreenRoot: { flex: 1, backgroundColor: colors.bg },
  blueDotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(66,133,244,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4285F4',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
});
