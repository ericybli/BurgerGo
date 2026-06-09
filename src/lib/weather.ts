/**
 * Weather via Open-Meteo (free, no API key, CORS-open). The forecast API only
 * covers ~16 days out, but trips are often months away — so for far-future dates
 * we fall back to the SAME calendar date one year earlier from the historical
 * archive as a climate proxy ("typical" weather). Pure helpers here (URL builders,
 * range decision, response normaliser, WMO code → emoji/label); the actual fetch +
 * coord resolution lives in the weather route so this stays unit-testable.
 */
import { addDays, diffDays } from '@/src/lib/days';

export type WeatherSource = 'forecast' | 'normal';

export interface DayWeather {
  date: string; // the requested trip date (YYYY-MM-DD)
  tMaxC: number;
  tMinC: number;
  code: number; // WMO weather code
  precipProb: number | null; // % (forecast only); null for climate normals
  source: WeatherSource;
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
/** Open-Meteo's forecast horizon — beyond this we use the historical climate proxy. */
export const FORECAST_HORIZON_DAYS = 16;

/** True when `date` is within [today, today+16] — i.e. a real forecast exists. */
export function isForecastRange(date: string, today: string): boolean {
  const n = diffDays(today, date);
  return n >= 0 && n <= FORECAST_HORIZON_DAYS;
}

/** The same calendar date one year earlier (climate-proxy lookup key). */
export function priorYearDate(date: string): string {
  // 365 days back keeps it simple + dodges Feb-29 (lands on Feb 28 in common years).
  return addDays(date, -365);
}

function fmt(lat: number, lng: number): string {
  // Trim coordinate precision — Open-Meteo snaps to a grid anyway, and it keeps
  // the cache key stable for nearby pins.
  return `latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}`;
}

/** Forecast endpoint for a single date (start=end=date). */
export function forecastUrl(lat: number, lng: number, date: string): string {
  return (
    `${FORECAST_URL}?${fmt(lat, lng)}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
    `&timezone=auto&start_date=${date}&end_date=${date}`
  );
}

/** Historical archive endpoint for a single date (used with priorYearDate). */
export function archiveUrl(lat: number, lng: number, date: string): string {
  return (
    `${ARCHIVE_URL}?${fmt(lat, lng)}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&timezone=auto&start_date=${date}&end_date=${date}`
  );
}

interface OpenMeteoDaily {
  daily?: {
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    weather_code?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

/**
 * Normalise an Open-Meteo daily response (single-day request → arrays of length 1)
 * into a `DayWeather`, or null when temps are missing. `requestedDate` is the trip
 * date the caller asked about (the archive response carries last-year's date, so we
 * stamp the trip date back on). `source` tags forecast vs climate-normal.
 */
export function normalizeDaily(
  json: unknown,
  requestedDate: string,
  source: WeatherSource,
): DayWeather | null {
  const daily = (json as OpenMeteoDaily)?.daily;
  if (!daily) return null;
  const tMax = daily.temperature_2m_max?.[0];
  const tMin = daily.temperature_2m_min?.[0];
  if (typeof tMax !== 'number' || typeof tMin !== 'number') return null;
  const code = daily.weather_code?.[0];
  const precip = source === 'forecast' ? daily.precipitation_probability_max?.[0] : null;
  return {
    date: requestedDate,
    tMaxC: tMax,
    tMinC: tMin,
    code: typeof code === 'number' ? code : 0,
    precipProb: typeof precip === 'number' ? precip : null,
    source,
  };
}

/** WMO weather code → a compact emoji + short English label (spec §F7). */
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
