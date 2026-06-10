/**
 * Plan-section helpers, local to screens/plan (file-ownership: lib/ is shared
 * and frozen, so anything Plan needs beyond it lives here). Pure UTC string
 * math for dates (Hermes Intl is unreliable), web-parity copies of
 * src/lib/{weather,exportDay,days,legView,budgetView} helpers.
 */
import { useEffect, useRef, useState } from 'react';
import type { Leg, Place, TravelMode } from '../../lib/api';
import type { BudgetCategory } from '../../lib/api';

// --- Date formatting (UTC-stable, no Intl) -----------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function utc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/** "Sat, Sep 5" — mirrors the web's en-US short format (UTC-stable). */
export function shortDate(dateStr: string): string {
  const d = utc(dateStr);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "May 3" (UTC-stable). */
export function monthDay(dateStr: string): string {
  const d = utc(dateStr);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Day-of-month without a leading zero ("5"). */
export function dayOfMonth(dateStr: string): string {
  return String(Number(dateStr.slice(8, 10)));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
}

export type TripStatus = 'upcoming' | 'active' | 'past';

/** Trip phase relative to the device's local "today" (web uses the trip TZ). */
export function tripStatus(trip: { startDate: string; endDate: string }, today: string): TripStatus {
  if (today < trip.startDate) return 'upcoming';
  if (today > trip.endDate) return 'past';
  return 'active';
}

/** Current local wall-clock "HH:MM" (web computes this in the trip TZ). */
export function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// --- Next-stop pointer (web src/lib/legView#nextStopIndex) -------------------

/** First stop scheduled after `now`, else stop 0; -1 when empty. */
export function nextStopIndex(orderedStops: readonly Place[], now: string): number {
  if (orderedStops.length === 0) return -1;
  const idx = orderedStops.findIndex((s) => s.scheduledTime !== null && s.scheduledTime > now);
  return idx === -1 ? 0 : idx;
}

// --- Weather (web src/lib/weather#weatherCodeInfo) ---------------------------

/** WMO weather code → compact emoji + short English label. */
export function weatherCodeInfo(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: 'Clear' };
  if (code <= 2) return { emoji: '🌤️', label: 'Partly cloudy' };
  if (code === 3) return { emoji: '☁️', label: 'Overcast' };
  if (code <= 48) return { emoji: '🌫️', label: 'Fog' };
  if (code <= 57) return { emoji: '🌦️', label: 'Drizzle' };
  if (code <= 67) return { emoji: '🌧️', label: 'Rain' };
  if (code <= 77) return { emoji: '❄️', label: 'Snow' };
  if (code <= 82) return { emoji: '🌦️', label: 'Showers' };
  if (code <= 86) return { emoji: '🌨️', label: 'Snow showers' };
  return { emoji: '⛈️', label: 'Thunderstorm' };
}

// --- Category display labels (web placeCategory i18n) ------------------------

const CATEGORY_LABELS: Record<string, string> = {
  sightseeing: 'Sightseeing',
  lodging: 'Lodging',
  hotel: 'Hotel',
  airbnb: 'Airbnb',
  airport: 'Airport',
  transport: 'Transport',
  activity: 'Activity',
  shopping: 'Shopping',
  parking: 'Parking',
  entrance: 'Entrance',
  museum: 'Museum',
  event: 'Event',
  other: 'Other',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? (category ? category[0]!.toUpperCase() + category.slice(1) : 'Other');
}

/** Place category → budget expense category (web src/lib/budgetView). */
export function placeCategoryToBudget(category: string): BudgetCategory {
  if (category === 'lodging' || category === 'hotel' || category === 'airbnb') return 'lodging';
  if (category === 'airport' || category === 'transport' || category === 'parking') return 'transport';
  if (
    category === 'activity' ||
    category === 'event' ||
    category === 'sightseeing' ||
    category === 'museum' ||
    category === 'entrance'
  ) {
    return 'activities';
  }
  if (category === 'shopping') return 'shopping';
  return 'other';
}

// --- Day text export (web src/lib/exportDay) ---------------------------------

export interface DayItineraryItem {
  name: string;
  category: string; // display label, e.g. "Sightseeing"
  time: string | null;
  address: string | null;
}

/**
 * `1. Name (Category) · 09:00` with the address indented on a second line.
 * Returns just the header when there are no items.
 */
export function formatDayItinerary(header: string, items: DayItineraryItem[]): string {
  if (items.length === 0) return header;
  const lines = items.map((it, i) => {
    const head = `${i + 1}. ${it.name} (${it.category})${it.time ? ` · ${it.time}` : ''}`;
    return it.address ? `${head}\n   ${it.address}` : head;
  });
  return `${header}\n\n${lines.join('\n')}`;
}

// --- Mode-aware leg lookup (web keys legs by from|to|mode) --------------------

export type LegLookup = Map<string, Leg>;

/** Index legs by `from|to|mode` — a mode switch shows "—" until recompute lands. */
export function indexLegsByMode(legs: Leg[]): LegLookup {
  const map: LegLookup = new Map();
  for (const l of legs) map.set(`${l.fromPlaceId}|${l.toPlaceId}|${l.mode}`, l);
  return map;
}

export function legFor(map: LegLookup, fromId: string, toId: string, mode: TravelMode): Leg | undefined {
  return map.get(`${fromId}|${toId}|${mode}`);
}

// --- Clipboard (expo-clipboard isn't installed; core fallback works) ----------

/** Copy text: web Clipboard API → RN core Clipboard (deprecated but present). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the native clipboard
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { Clipboard?: { setString(t: string): void } };
    if (rn.Clipboard?.setString) {
      rn.Clipboard.setString(text);
      return true;
    }
  } catch {
    // no clipboard available — the export textarea stays selectable
  }
  return false;
}

// --- Two-tap confirm (Alert.alert is a no-op on web) --------------------------

/**
 * First fire() arms (render a danger "Sure? …" state while `armed`); second
 * fire() runs the action. Auto-disarms after `timeoutMs`.
 */
export function useTwoTapConfirm(action: () => void, timeoutMs = 3000) {
  const [armed, setArmed] = useState(false);
  const actionRef = useRef(action);
  actionRef.current = action;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function disarm() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  }

  function fire() {
    if (armed) {
      disarm();
      actionRef.current();
      return;
    }
    setArmed(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), timeoutMs);
  }

  return { armed, fire, disarm };
}

// --- Misc ---------------------------------------------------------------------

/** http(s) URL check for the guide-link input (web src/lib/linkPreview). */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+\.\S+/.test(value.trim());
}
