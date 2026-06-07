'use client';

import type { PlaceMarker } from '@/src/lib/map/markers';
import type { DayPath } from '@/src/lib/map/types';
import { MAP_PROVIDER } from '@/src/lib/map/provider';
import { GoogleMapCanvas } from '@/components/map/GoogleMapCanvas';
import { MapboxCanvas } from '@/components/map/MapboxCanvas';

export interface MapCanvasProps {
  markers: PlaceMarker[];
  paths: DayPath[];
  onMarkerClick: (placeId: string) => void;
}

/**
 * Provider-agnostic map. Renders Mapbox or Google based on the build-time
 * `NEXT_PUBLIC_MAP_PROVIDER` flag — both renderers implement the same props, so
 * PlanMap consumes this one component and never knows which engine is active.
 */
export function MapCanvas(props: MapCanvasProps) {
  if (MAP_PROVIDER === 'mapbox') return <MapboxCanvas {...props} />;
  return <GoogleMapCanvas {...props} />;
}
