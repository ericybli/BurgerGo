/**
 * Wire DTOs for the hosted BurgerGo JSON API. Drizzle `timestamp` columns
 * serialize to ISO-8601 strings; none of them are rendered, so they're typed
 * `string`. Money is integer minor units end-to-end.
 */

export type Trip = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  coverPhoto: string | null;
};

export type TravelMode = 'walk' | 'drive' | 'transit';

export type Place = {
  id: string;
  tripId: string;
  dayDate: string | null; // null = Saved bucket
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category: string;
  scheduledTime: string | null; // "HH:MM"
  durationMin: number | null;
  cost: number | null; // integer minor units
  notes: string | null;
  /** Mode of the leg arriving at this place; null → follow the day default. */
  legMode: TravelMode | null;
  /** Saved-bucket grouping: the saved list this place is in, or null = "loose". */
  listId: string | null;
  orderIndex: number;
  photoPath: string | null;
  aiSummary: string | null;
  photos: { id: string; width: number | null; height: number | null }[];
  links: { id: string; url: string; title: string | null; thumbnail: string | null }[];
};

/** One cached travel leg between two consecutive stops on a day. */
export type Leg = {
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
  durationSeconds: number;
  distanceMeters: number;
  polyline: string | null;
};

export type PlacesResponse = {
  places: Place[];
  legs: Leg[];
  dayModes: Record<string, TravelMode>;
  /** Sparse per-day titles: date (YYYY-MM-DD) → user title. */
  dayTitles: Record<string, string>;
  lists: { id: string; name: string }[];
  currency: string;
};

/** Editable place fields (all optional); see the backend updateSchema. */
export type PlacePatch = Partial<{
  name: string;
  address: string | null;
  category: string;
  scheduledTime: string | null;
  cost: number | null;
  notes: string | null;
  aiSummary: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
}>;

// --- Eats ------------------------------------------------------------------

export type RestaurantStatus = 'want-to-try' | 'been';

export type RestaurantPhoto = { id: string; width: number | null; height: number | null };

export type Restaurant = {
  id: string;
  tripId: string;
  name: string;
  cuisine: string | null;
  rating: number | null; // 1..5
  status: RestaurantStatus;
  priceLevel: number | null; // 1..4
  notes: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  linkedPlaceId: string | null;
  /** Persisted Google data (refreshed on add/update). */
  googleRating: number | null;
  googleRatingCount: number | null;
  googleHours: string | null; // JSON array of localized weekday lines
  googleDataUpdatedAt: string | null;
  scheduledDayDate: string | null; // derived
  photoPath: string | null; // derived (cached Google photo flag)
  photos: RestaurantPhoto[]; // derived (personal uploads)
};

export type RestaurantInput = {
  name: string;
  cuisine?: string | null;
  rating?: number | null;
  status?: RestaurantStatus;
  priceLevel?: number | null;
  notes?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string | null;
};

// --- Budget ----------------------------------------------------------------

export type BudgetCategory =
  | 'food'
  | 'lodging'
  | 'transport'
  | 'activities'
  | 'shopping'
  | 'other';

export type Expense = {
  id: string;
  tripId: string;
  amount: number; // integer minor units, > 0
  category: BudgetCategory;
  spentOn: string; // YYYY-MM-DD
  note: string | null;
  linkedPlaceId: string | null;
  placeName: string | null; // derived
};

export type ExpenseInput = {
  amount: number;
  category: BudgetCategory;
  spentOn: string;
  note?: string | null;
  linkedPlaceId?: string | null;
};

export type BudgetTarget = {
  id: string;
  tripId: string;
  category: BudgetCategory | null; // null = overall
  plannedAmount: number; // integer minor units, > 0
};

export type PlaceOption = { id: string; name: string };

export type BudgetResponse = {
  expenses: Expense[];
  targets: BudgetTarget[];
  places: PlaceOption[];
  currency: string;
};

// --- To do (packing + tasks) ----------------------------------------------

export type PackingItem = {
  id: string;
  categoryId: string;
  name: string;
  quantity: number;
  packed: boolean;
  orderIndex: number;
};

export type PackingCategory = {
  id: string;
  tripId: string;
  name: string;
  orderIndex: number;
  items: PackingItem[];
};

export type Task = {
  id: string;
  tripId: string;
  title: string;
  note: string | null;
  done: boolean;
  orderIndex: number;
};

// --- Journal ---------------------------------------------------------------

export type JournalPhoto = {
  id: string;
  tripId: string;
  ownerType: string;
  ownerId: string;
  path: string;
  width: number | null;
  height: number | null;
  orderIndex: number;
};

export type JournalEntry = {
  id: string;
  tripId: string;
  title: string;
  body: string;
  entryDate: string | null;
  photos: JournalPhoto[];
};

export type SavedLink = {
  id: string;
  tripId: string;
  url: string;
  title: string | null;
  note: string | null;
  thumbnail: string | null;
  placeId: string | null;
};

// Photography lists (curated photo collections, ownerType 'photo_list').
export type PhotoList = {
  id: string;
  tripId: string;
  name: string;
  orderIndex: number;
  photos: JournalPhoto[];
};

export type JournalResponse = {
  entries: JournalEntry[];
  links: SavedLink[];
  photoLists: PhotoList[];
};

// --- Tickets (reservations + attachments) -----------------------------------

export type TicketFile = {
  id: string;
  ticketId: string;
  tripId: string;
  name: string; // display filename
  path: string;
  mime: string; // application/pdf or image/*
  size: number;
};

export type Ticket = {
  id: string;
  tripId: string;
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  location: string | null;
  note: string | null;
  files: TicketFile[];
};

export type TicketInput = {
  title: string;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  note?: string | null;
};

// --- Weather (Open-Meteo via backend) ----------------------------------------

export type DayWeather = {
  date: string; // YYYY-MM-DD
  tMaxC: number;
  tMinC: number;
  code: number; // WMO weather code
  precipProb: number | null; // % (forecast only); null for climate normals
  source: 'forecast' | 'normal'; // normal = last-year climate proxy
};

// --- Google proxies (autocomplete / details / POI) ----------------------------

export type AutocompletePrediction = { placeId: string; description: string };

/** Basic place details (add-place autocomplete flow). */
export type GooglePlaceDetails = {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  categoryGuess: string;
  photoRef: string | null;
  photoLocalPath?: string | null;
  /** True when served from the place-details cache. */
  cached?: boolean;
};

export type PoiReview = {
  author: string;
  rating: number | null;
  time: string | null;
  text: string;
};

/** Rich Place Details for the map's POI card. */
export type PoiDetails = {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  categoryGuess: string;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  hours: string[]; // localized weekday lines
  summary: string | null;
  photoRefs: string[]; // served via /api/google/poi-photo
  reviews: PoiReview[];
  isFood: boolean; // dining POI → "Save restaurant" action
};

// --- AI import (paste text/screenshots → proposed places/restaurants) -------

export type ImportPreviewItem = {
  type: 'restaurant' | 'place';
  name: string;
  address: string | null;
  area: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  cuisine: string;
  category: string;
  notes: string;
  /** Did Google find a match (coords + place id)? false → unmatched. */
  resolved: boolean;
};

export type ImportCreateItem = {
  type: 'restaurant' | 'place';
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string | null;
  cuisine?: string | null;
  category?: string | null;
  notes?: string | null;
};

// --- Settings --------------------------------------------------------------

export type Settings = {
  id?: number;
  language: 'en' | 'zh';
  currency: string;
  aiPrompt: string | null;
  aiModel: string | null;
};

// --- Account / trip members --------------------------------------------------

export interface Me {
  id: string;
  name: string;
  email: string;
  /** Relative avatar path (`/api/avatars/<id>?v=…`) or null. */
  image: string | null;
}

export interface TripMemberView {
  id: string;
  tripId: string;
  userId: string | null;
  invitedEmail: string;
  role: 'owner' | 'member';
  name: string | null;
  image: string | null;
}
