/**
 * Shared state + derived data for both PlanMap platforms. Owns everything
 * except the map canvas itself: layer toggles, fullscreen, satellite, the
 * tapped-leg chip, the POI card, the restaurant card, and the persisted POI
 * toggle — plus all pin/segment/legend/route-link derivations from props.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from '../../../lib/api';
import type { MapDayGroup, MapRestaurant, PlanMapProps } from '../PlanMap.types';
import {
  buildDayPins,
  buildLegSegs,
  buildRestaurantPins,
  buildRouteLinks,
  buildSavedPins,
  fitKeyFor,
  type MapPin,
  type MapSeg,
  type RouteLink,
} from './mapData';

const POI_PREF_KEY = 'bg.poiEnabled';

export type LegendEntry = { date: string; dayNumber: number; color: string; visible: boolean };

export type OfflinePlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  address: string | null;
};

export type MapShell = ReturnType<typeof useMapShell>;

export function useMapShell(props: PlanMapProps, opts: { poiSupported: boolean }) {
  const { bucket, dayGroups, legs, savedPlaces, restaurants, dayModes, selectedDate } = props;

  // --- Chrome state ---------------------------------------------------------
  const [layersOpen, setLayersOpen] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showSaved, setShowSaved] = useState(false);
  const [showRestaurants, setShowRestaurants] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [locating, setLocating] = useState(false);

  // POI toggle: default OFF, persisted device-locally.
  const [poiEnabled, setPoiEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(POI_PREF_KEY)
      .then((v) => {
        if (!cancelled && v === '1') setPoiEnabled(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const togglePoi = useCallback(() => {
    setPoiEnabled((prev) => {
      const next = !prev;
      AsyncStorage.setItem(POI_PREF_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  // --- Overlay cards --------------------------------------------------------
  const [tappedLeg, setTappedLeg] = useState<MapSeg | null>(null);
  const [poiPlaceId, setPoiPlaceId] = useState<string | null>(null);
  const [restaurantCard, setRestaurantCard] = useState<MapRestaurant | null>(null);

  // Clear the leg chip whenever the visible route set changes (web parity).
  useEffect(() => {
    setTappedLeg(null);
  }, [selectedDate, bucket, dayModes]);

  // --- Derived data ---------------------------------------------------------
  const visibleGroups: MapDayGroup[] = useMemo(
    () =>
      bucket === 'days'
        ? selectedDate
          ? dayGroups.filter((g) => g.date === selectedDate)
          : dayGroups
        : [],
    [bucket, dayGroups, selectedDate],
  );

  const dayPins = useMemo(() => visibleGroups.flatMap(buildDayPins), [visibleGroups]);
  const savedBucketPins = useMemo(
    () => (bucket === 'saved' ? buildSavedPins(savedPlaces) : []),
    [bucket, savedPlaces],
  );
  const savedLayerPins = useMemo(
    () => (bucket === 'days' && showSaved ? buildSavedPins(savedPlaces) : []),
    [bucket, showSaved, savedPlaces],
  );
  const restaurantLayerPins = useMemo(
    () => (bucket === 'days' && showRestaurants ? buildRestaurantPins(restaurants) : []),
    [bucket, showRestaurants, restaurants],
  );

  /** Base pins define the viewport; overlay layers never affect the fit. */
  const basePins: MapPin[] = bucket === 'days' ? dayPins : savedBucketPins;
  const pins: MapPin[] = useMemo(
    () =>
      bucket === 'days'
        ? [...dayPins, ...savedLayerPins, ...restaurantLayerPins]
        : savedBucketPins,
    [bucket, dayPins, savedLayerPins, restaurantLayerPins, savedBucketPins],
  );
  const fitKey = fitKeyFor(basePins);

  const segs: MapSeg[] = useMemo(
    () => (bucket === 'days' && showRoutes ? buildLegSegs(visibleGroups, legs, dayModes) : []),
    [bucket, showRoutes, visibleGroups, legs, dayModes],
  );

  const legend: LegendEntry[] = useMemo(
    () =>
      bucket === 'days'
        ? dayGroups.map((g) => ({
            date: g.date,
            dayNumber: g.dayNumber,
            color: g.color,
            visible: selectedDate === null || selectedDate === g.date,
          }))
        : [],
    [bucket, dayGroups, selectedDate],
  );
  const allVisible = legend.length > 0 && legend.every((l) => l.visible);

  const routeLinks: RouteLink[] = useMemo(
    () => (bucket === 'days' ? buildRouteLinks(visibleGroups, dayModes) : []),
    [bucket, visibleGroups, dayModes],
  );

  /** Offline branch: every visible plottable place as a deep-link row. */
  const offlinePlaces: OfflinePlace[] = useMemo(() => {
    const source: Place[] =
      bucket === 'days' ? visibleGroups.flatMap((g) => g.stops) : savedPlaces;
    return source
      .filter((p): p is Place & { lat: number; lng: number } => p.lat != null && p.lng != null)
      .map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        googlePlaceId: p.googlePlaceId,
        address: p.address,
      }));
  }, [bucket, visibleGroups, savedPlaces]);

  // --- Tap routing -----------------------------------------------------------
  const handlePinPress = useCallback(
    (pin: MapPin) => {
      if (pin.kind === 'restaurant' && pin.restaurant) {
        setRestaurantCard(pin.restaurant);
      } else if (pin.place) {
        props.onViewPlace(pin.place);
      }
    },
    [props.onViewPlace],
  );

  return {
    // chrome
    layersOpen,
    setLayersOpen,
    showRoutes,
    setShowRoutes,
    showSaved,
    setShowSaved,
    showRestaurants,
    setShowRestaurants,
    fullscreen,
    setFullscreen,
    satellite,
    setSatellite,
    locating,
    setLocating,
    poiSupported: opts.poiSupported,
    poiEnabled,
    togglePoi,
    // overlays
    tappedLeg,
    setTappedLeg,
    poiPlaceId,
    setPoiPlaceId,
    restaurantCard,
    setRestaurantCard,
    // derived
    visibleGroups,
    pins,
    basePins,
    fitKey,
    segs,
    legend,
    allVisible,
    routeLinks,
    offlinePlaces,
    handlePinPress,
  };
}
