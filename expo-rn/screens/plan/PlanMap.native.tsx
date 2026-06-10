/**
 * Plan map — native shell. ALL floating chrome (legend, Atlas controls, leg
 * chip, POI/restaurant cards, fullscreen Modal, route links) is shared here;
 * only the canvas differs per platform:
 *   iOS     → GoogleWebCanvas: Google Maps JS API inside a WebView (Expo Go
 *             has no native Google provider on iOS; Apple Maps lacked POI
 *             taps and Google-parity styling).
 *   Android → NativeCanvas: react-native-maps (PROVIDER_DEFAULT = Google).
 * Canvases REMOUNT when the fullscreen Modal toggles (a Modal is the only way
 * to cover the day strip/tab bar), so their viewport state lives up here in
 * persist refs (tracked region/camera + last applied fit key) — the view is
 * restored on remount and never refits.
 */
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors } from '../../lib/theme';
import type { LatLng } from '../../lib/legView';
import type { PlanMapProps } from './PlanMap.types';
import type { MapSeg } from './map/mapData';
import { useMapShell } from './map/useMapShell';
import type { MapCanvasHandle } from './map/canvasTypes';
import { NativeCanvas, type NativeCanvasPersist } from './map/NativeCanvas';
import { GoogleWebCanvas, type WebCanvasPersist } from './map/GoogleWebCanvas';
import { EmptyMapHint } from './map/EmptyHint';
import { MapChrome } from './map/MapChrome';
import { LegChip } from './map/LegChip';
import { DayLegend } from './map/DayLegend';
import { RouteLinks } from './map/RouteLinks';
import { OfflineMap } from './map/OfflineMap';
import { PoiCard } from './map/PoiCard';
import { RestaurantCard } from './map/RestaurantCard';

export type { MapDayGroup, MapRestaurant } from './PlanMap.types';

const IS_IOS = Platform.OS === 'ios';

// Basemap POI taps work on both canvases now: Android via the Google
// provider's onPoiClick, iOS via clickableIcons in the Google JS WebView.
const POI_SUPPORTED = true;

export default function PlanMap(props: PlanMapProps) {
  const shell = useMapShell(props, { poiSupported: POI_SUPPORTED });
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<MapCanvasHandle | null>(null);
  // Cross-remount canvas state (the canvas remounts on fullscreen toggle).
  const nativePersistRef = useRef<NativeCanvasPersist>({ region: null, fitKey: '' });
  const webPersistRef = useRef<WebCanvasPersist>({ camera: null, fitKey: '' });
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
      canvasRef.current?.panToUser(here);
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

  const handleLegTap = (seg: MapSeg) => {
    legTapAtRef.current = Date.now();
    setTappedLeg(seg);
  };
  const handleMapTap = () => {
    if (Date.now() - legTapAtRef.current < 400) return;
    setTappedLeg(null);
    shell.setLayersOpen(false);
  };
  const handlePoiTap = (placeId: string) => {
    if (!shell.poiEnabled) return;
    setPoiPlaceId(placeId);
  };

  const canvasProps = {
    pins,
    basePins,
    fitKey,
    segs,
    satellite: shell.satellite,
    poiEnabled: shell.poiEnabled,
    userLoc,
    onPinPress: shell.handlePinPress,
    onLegTap: handleLegTap,
    onMapTap: handleMapTap,
    onPoiTap: handlePoiTap,
  };

  // The whole map block (canvas + floating chrome + cards). Rendered inline
  // normally; inside a true full-screen Modal when fullscreen. The canvas
  // remounts on toggle and restores its viewport from the persist ref.
  const mapBlock = (
      <View style={s.mapBox}>
        {IS_IOS ? (
          <GoogleWebCanvas ref={canvasRef} {...canvasProps} persist={webPersistRef} />
        ) : (
          <NativeCanvas ref={canvasRef} {...canvasProps} persist={nativePersistRef} />
        )}

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

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  mapBox: { flex: 1, overflow: 'hidden' },
  fullscreenRoot: { flex: 1, backgroundColor: colors.bg },
});
