/**
 * Android map canvas (react-native-maps; PROVIDER_DEFAULT = Google on
 * Android). Extracted verbatim from the old PlanMap.native.tsx MapView block:
 * per-leg visible + wide invisible hit polylines, tracksViewChanges-managed
 * compound pins, the blue location dot, and the fit-once-per-position-change
 * viewport. The component REMOUNTS when the fullscreen Modal toggles, so the
 * tracked region (→ initialRegion) and the last fit key live in the
 * caller-owned `persist` ref — viewport preserved, no spurious refit.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import { regionForCoords, type LatLng } from '../../../lib/legView';
import type { MapPin, MapSeg } from './mapData';
import { PinView } from './Pin';
import type { MapCanvasHandle, MapCanvasProps } from './canvasTypes';

/** Cross-remount canvas state, owned by PlanMap.native.tsx. */
export type NativeCanvasPersist = { region: Region | null; fitKey: string };

const EDGE_PADDING = { top: 64, right: 48, bottom: 64, left: 48 };

export const NativeCanvas = forwardRef<
  MapCanvasHandle,
  MapCanvasProps & { persist: { current: NativeCanvasPersist } }
>(function NativeCanvas(props, ref) {
  const { pins, basePins, fitKey, segs, satellite, poiEnabled, userLoc, persist } = props;
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Fit ONLY when the base-pin positions actually change; layer toggles, card
  // opens, and fullscreen never refit (the last key survives the remount).
  useEffect(() => {
    if (!mapReady || !fitKey || fitKey === persist.current.fitKey) return;
    persist.current.fitKey = fitKey;
    mapRef.current?.fitToCoordinates(
      basePins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: EDGE_PADDING, animated: false },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, fitKey]);

  useImperativeHandle(
    ref,
    () => ({
      panToUser(here: LatLng) {
        // Pan to the fix; raise zoom to ≈14 (delta 0.02) only if currently lower.
        const delta = Math.min(persist.current.region?.latitudeDelta ?? 0.02, 0.02);
        mapRef.current?.animateToRegion(
          { ...here, latitudeDelta: delta, longitudeDelta: delta },
          350,
        );
      },
    }),
    [persist],
  );

  // Online-but-empty selection keeps the canvas live; with no pins the fit is
  // skipped, so the viewport simply persists.
  const initialRegion =
    regionForCoords(basePins.map((p) => ({ latitude: p.lat, longitude: p.lng }))) ?? undefined;

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      mapType={satellite ? 'hybrid' : 'standard'}
      initialRegion={persist.current.region ?? initialRegion}
      onMapReady={() => setMapReady(true)}
      onRegionChangeComplete={(r) => {
        persist.current.region = r;
      }}
      onPress={props.onMapTap}
      onPoiClick={(e) => {
        if (!poiEnabled) return;
        const id = e.nativeEvent.placeId;
        if (id) props.onPoiTap(id);
      }}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {segs.flatMap((seg) => segPolylines(seg, props.onLegTap))}
      {pins.map((pin) => (
        <NativePin key={pin.key} pin={pin} onPress={() => props.onPinPress(pin)} />
      ))}
      {userLoc ? (
        <Marker coordinate={userLoc} anchor={{ x: 0.5, y: 0.5 }} zIndex={9999}>
          <View style={s.blueDotRing}>
            <View style={s.blueDot} />
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
});

/**
 * Visible route line + a wide invisible hit line per leg. Walk legs are dotted
 * (round dash); drive/transit solid. react-native-maps requires Polyline
 * elements as direct MapView children, so this returns a flat array.
 */
function segPolylines(seg: MapSeg, onLegTap: (seg: MapSeg) => void) {
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
      onPress={() => onLegTap(seg)}
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
