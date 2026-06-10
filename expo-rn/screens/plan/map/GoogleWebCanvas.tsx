/**
 * iOS map canvas — Google Maps JS API inside a react-native-webview (Expo Go
 * on iOS has no native Google provider; this replaces the old Apple Maps
 * canvas). The page is the self-contained HTML from webviewMapHtml.ts; RN and
 * the page exchange JSON:
 *
 *   RN → page  SET_DATA / SET_MAPTYPE / SET_POI / SET_USER_LOC / SET_CAMERA
 *              (via injectJavaScript → window.__bgDispatch; messages queue
 *              here until the page posts READY)
 *   page → RN  READY / PIN_TAP / LEG_TAP / POI_TAP / MAP_TAP / REGION / ERROR
 *              (RN resolves pins/segs by key and calls the chrome callbacks)
 *
 * The WebView REMOUNTS when the fullscreen Modal toggles; the latest REGION
 * and applied fit key live in the caller-owned `persist` ref and are baked
 * into the next HTML build, so the camera is restored without a refit.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import RNWebView from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview/lib/WebView';
import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';
import { EmptyState } from '../../../components/ui';
import { colors } from '../../../lib/theme';
import type { MapPin, MapSeg } from './mapData';
import type { MapCanvasHandle, MapCanvasProps } from './canvasTypes';
import { buildMapHtml, type WebCanvasCamera } from './webviewMapHtml';

// Literal env read (Metro inlines EXPO_PUBLIC_* only when read literally).
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

// baseUrl for the HTML document: lets a future referrer restriction on the
// browser key allowlist the site (the WebView sends this as the page origin).
const BASE_URL = 'https://eric.month2month.com';

/** Cross-remount canvas state, owned by PlanMap.native.tsx. */
export type WebCanvasPersist = { camera: WebCanvasCamera | null; fitKey: string };

// react-native-webview v13 types don't surface the imperative handle (ref is
// typed {}); declare the one method we use and re-type the component.
type WebViewHandle = { injectJavaScript: (script: string) => void };
const WebView = RNWebView as unknown as ComponentType<
  WebViewProps & { ref?: Ref<WebViewHandle> }
>;

/** Serialized pin sent to the page (MapPin minus the backing records). */
function wirePin(p: MapPin) {
  return {
    key: p.key,
    kind: p.kind,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    color: p.color,
    glyph: p.glyph,
    label: p.label,
    scheduledTime: p.scheduledTime,
  };
}

/** Serialized segment: key + color + mode + {lat,lng} path. */
function wireSeg(sg: MapSeg) {
  return {
    key: sg.key,
    color: sg.color,
    mode: sg.mode,
    path: sg.path.map((pt) => ({ lat: pt.latitude, lng: pt.longitude })),
  };
}

export const GoogleWebCanvas = forwardRef<
  MapCanvasHandle,
  MapCanvasProps & { persist: { current: WebCanvasPersist } }
>(function GoogleWebCanvas(props, ref) {
  const { pins, basePins, fitKey, segs, satellite, poiEnabled, userLoc, persist } = props;
  const webRef = useRef<WebViewHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const readyRef = useRef(false);
  const queueRef = useRef<object[]>([]);

  // Built ONCE per mount: the persisted camera + fit key are baked in so a
  // fullscreen remount restores the viewport and skips the refit.
  const html = useMemo(
    () =>
      buildMapHtml({
        apiKey: MAPS_KEY ?? '',
        camera: persist.current.camera,
        fitKey: persist.current.fitKey,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const sendNow = useCallback((msg: object) => {
    webRef.current?.injectJavaScript(`window.__bgDispatch(${JSON.stringify(msg)});true;`);
  }, []);

  /** Queue until the page posts READY, then send straight through. */
  const send = useCallback(
    (msg: object) => {
      if (readyRef.current) sendNow(msg);
      else queueRef.current.push(msg);
    },
    [sendNow],
  );

  // Push the full overlay state whenever it changes (and on mount, queued).
  useEffect(() => {
    send({
      type: 'SET_DATA',
      pins: pins.map(wirePin),
      segs: segs.map(wireSeg),
      fitKey,
      fitCoords: basePins.map((p) => ({ lat: p.lat, lng: p.lng })),
    });
    // Mirror the page's lastFitKey rule so the next remount's bake matches.
    if (fitKey && fitKey !== persist.current.fitKey) persist.current.fitKey = fitKey;
  }, [send, pins, segs, fitKey, basePins, persist]);

  useEffect(() => {
    send({ type: 'SET_MAPTYPE', satellite });
  }, [send, satellite]);

  useEffect(() => {
    send({ type: 'SET_POI', enabled: poiEnabled });
  }, [send, poiEnabled]);

  // Blue dot restore (remounts / prop changes) never pans; only locate pans.
  useEffect(() => {
    if (userLoc) {
      send({ type: 'SET_USER_LOC', lat: userLoc.latitude, lng: userLoc.longitude, pan: false });
    }
  }, [send, userLoc]);

  useImperativeHandle(
    ref,
    () => ({
      panToUser(here) {
        send({ type: 'SET_USER_LOC', lat: here.latitude, lng: here.longitude, pan: true });
      },
    }),
    [send],
  );

  const pinsByKey = useMemo(() => new Map(pins.map((p) => [p.key, p])), [pins]);
  const segsByKey = useMemo(() => new Map(segs.map((sg) => [sg.key, sg])), [segs]);

  function onMessage(e: WebViewMessageEvent) {
    let msg: { type?: string; key?: string; placeId?: string; lat?: number; lng?: number; zoom?: number };
    try {
      msg = JSON.parse(e.nativeEvent.data) as typeof msg;
    } catch {
      return;
    }
    switch (msg.type) {
      case 'READY': {
        readyRef.current = true;
        setReady(true);
        const queued = queueRef.current;
        queueRef.current = [];
        for (const m of queued) sendNow(m);
        break;
      }
      case 'PIN_TAP': {
        const pin = msg.key != null ? pinsByKey.get(msg.key) : undefined;
        if (pin) props.onPinPress(pin);
        break;
      }
      case 'LEG_TAP': {
        const seg = msg.key != null ? segsByKey.get(msg.key) : undefined;
        if (seg) props.onLegTap(seg);
        break;
      }
      case 'POI_TAP':
        if (typeof msg.placeId === 'string') props.onPoiTap(msg.placeId);
        break;
      case 'MAP_TAP':
        props.onMapTap();
        break;
      case 'REGION':
        if (
          typeof msg.lat === 'number' &&
          typeof msg.lng === 'number' &&
          typeof msg.zoom === 'number'
        ) {
          persist.current.camera = { lat: msg.lat, lng: msg.lng, zoom: msg.zoom };
        }
        break;
      case 'ERROR':
        setFailed(true);
        break;
    }
  }

  if (!MAPS_KEY) {
    return (
      <View style={[StyleSheet.absoluteFill, s.bg]}>
        <EmptyState
          headline="Map unavailable"
          subtext="Set EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY to show the trip map."
        />
      </View>
    );
  }

  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, s.bg]}>
        <EmptyState
          headline="Map couldn't load"
          subtext="Check your connection and the Google Maps key, then try again."
        />
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, s.bg]}>
      <WebView
        ref={webRef}
        style={s.web}
        source={{ html, baseUrl: BASE_URL }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        bounces={false}
        scrollEnabled={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        // Keep the canvas captive: Google attribution links open externally.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith(BASE_URL) || req.url.startsWith('about:')) return true;
          if (req.url.startsWith('http')) Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
      {/* colors.surface veil until the map exists — no white flash. */}
      {!ready ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.bg]} /> : null}
    </View>
  );
});

const s = StyleSheet.create({
  bg: { backgroundColor: colors.surface },
  web: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface },
});
