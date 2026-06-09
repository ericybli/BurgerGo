import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { now } from '@/src/lib/clock';
import { getTrip } from '@/src/db/repos/trips';
import { listAllForTrip } from '@/src/db/repos/places';
import {
  isForecastRange,
  priorYearDate,
  forecastUrl,
  archiveUrl,
  normalizeDaily,
  type WeatherSource,
} from '@/src/lib/weather';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's calendar date (YYYY-MM-DD) in the container timezone — matches days.ts. */
function todayInTz(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: env.TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now()));
}

/** Representative coordinate for a day's weather: centroid of that day's pinned
 *  places, falling back to the centroid of all the trip's pins. null if none. */
function resolveCoords(tripId: string, date: string): { lat: number; lng: number } | null {
  const pins = listAllForTrip(db, tripId).filter(
    (p): p is typeof p & { lat: number; lng: number } => p.lat != null && p.lng != null,
  );
  if (pins.length === 0) return null;
  const onDay = pins.filter((p) => p.dayDate === date);
  const pool = onDay.length > 0 ? onDay : pins;
  const lat = pool.reduce((s, p) => s + p.lat, 0) / pool.length;
  const lng = pool.reduce((s, p) => s + p.lng, 0) / pool.length;
  return { lat, lng };
}

/**
 * Daily weather for one trip date. `?date=YYYY-MM-DD`. Within ~16 days → real
 * forecast; beyond that → the historical archive for the same date last year as a
 * climate proxy ("typical"). Always 200 with `{ weather: DayWeather | null }` —
 * null when there are no pinned coords or the upstream is unavailable (offline-safe;
 * the SW data cache serves the last good value). Open-Meteo is free + key-less.
 */
export async function GET(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  if (!getTrip(db, tripId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const date = new URL(req.url).searchParams.get('date');
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const coords = resolveCoords(tripId, date);
  if (!coords) return NextResponse.json({ weather: null });

  const forecast = isForecastRange(date, todayInTz());
  const source: WeatherSource = forecast ? 'forecast' : 'normal';
  const url = forecast
    ? forecastUrl(coords.lat, coords.lng, date)
    : archiveUrl(coords.lat, coords.lng, priorYearDate(date));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ weather: null });
    return NextResponse.json({ weather: normalizeDaily(await res.json(), date, source) });
  } catch {
    return NextResponse.json({ weather: null });
  }
}
