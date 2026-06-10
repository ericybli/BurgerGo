import type { Leg, Place, PoiDetails, TravelMode } from '../../lib/api';

/**
 * Shared contract for the platform-split map (PlanMap.native / PlanMap.web).
 * COORDINATION POINT: PlanScreen (plan-list owner) passes exactly these props;
 * both map implementations consume exactly these props. Change only here.
 */
export type MapDayGroup = { date: string; dayNumber: number; color: string; stops: Place[] };

export type MapRestaurant = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cuisine: string | null;
  // Richer restaurant-pin card (web parity). Optional so the two plan agents
  // can land independently: PlanScreen fills these; the map renders them.
  address?: string | null;
  googlePlaceId?: string | null;
  /** Prebuilt card photo URL (first personal photo → cached Google), or null. */
  photoUrl?: string | null;
  /** Persisted Google rating, when known. */
  googleRating?: number | null;
  /** Persisted Google weekday hours (JSON array of localized lines). */
  googleHours?: string | null;
};

export type PlanMapProps = {
  /** 'days' shows day groups + routes + legend; 'saved' shows saved pins. */
  bucket: 'days' | 'saved';
  /** ALL day groups; the map filters to `selectedDate` itself (null = all). */
  dayGroups: MapDayGroup[];
  legs: Leg[];
  savedPlaces: Place[];
  restaurants: MapRestaurant[];
  /** Per-day travel mode (absent date → 'drive'); used for route deep links + leg fallbacks. */
  dayModes: Record<string, TravelMode>;
  /** List↔map day sync: the selected day, or null = all days. */
  selectedDate: string | null;
  /** Map-side day selection (legend chip / "All days") must call this. */
  onSelectDate: (date: string | null) => void;
  online: boolean;
  onViewPlace: (place: Place) => void;
  /**
   * POI-card actions. Each resolves once the backend write lands (the card
   * shows busy → added states). Save restaurant is shown for `poi.isFood`,
   * the other two otherwise.
   */
  onPoiSavePlace: (poi: PoiDetails) => Promise<void>;
  onPoiAddToDay: (poi: PoiDetails, dayDate: string) => Promise<void>;
  onPoiSaveRestaurant: (poi: PoiDetails) => Promise<void>;
};
