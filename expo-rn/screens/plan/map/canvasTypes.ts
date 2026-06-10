/**
 * Shared contract between PlanMap.native.tsx (the chrome owner) and the two
 * per-platform canvases (Android NativeCanvas / iOS GoogleWebCanvas). All
 * behavior/state lives in useMapShell at the chrome level; canvases only
 * render pins/segments and report taps back through these callbacks.
 */
import type { LatLng } from '../../../lib/legView';
import type { MapPin, MapSeg } from './mapData';

/**
 * Imperative surface both canvases expose for the locate flow: the blue dot
 * itself is prop-driven (`userLoc`); this pans the camera to the fix and
 * raises zoom to ≈14 (delta 0.02) ONLY if the current view is wider.
 */
export type MapCanvasHandle = {
  panToUser: (here: LatLng) => void;
};

export type MapCanvasProps = {
  pins: MapPin[];
  /** Pins that define the viewport (fit target); overlay layers excluded. */
  basePins: MapPin[];
  /** Position key for the fit set; the canvas refits ONCE per distinct value. */
  fitKey: string;
  segs: MapSeg[];
  satellite: boolean;
  poiEnabled: boolean;
  /** Blue-dot position (null until the first successful locate). */
  userLoc: LatLng | null;
  onPinPress: (pin: MapPin) => void;
  onLegTap: (seg: MapSeg) => void;
  /** Plain map tap. The chrome applies the 400ms leg-tap suppression. */
  onMapTap: () => void;
  /** Basemap POI tap. The chrome gates on poiEnabled as the final authority. */
  onPoiTap: (placeId: string) => void;
};
