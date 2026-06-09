import { describe, it, expect } from 'vitest';
import {
  isForecastRange,
  priorYearDate,
  forecastUrl,
  archiveUrl,
  normalizeDaily,
  weatherCodeInfo,
} from '@/src/lib/weather';

describe('weather helpers', () => {
  it('isForecastRange: today..+16 is forecastable, past + far-future are not', () => {
    expect(isForecastRange('2026-06-08', '2026-06-08')).toBe(true); // today
    expect(isForecastRange('2026-06-24', '2026-06-08')).toBe(true); // +16
    expect(isForecastRange('2026-06-25', '2026-06-08')).toBe(false); // +17
    expect(isForecastRange('2026-06-07', '2026-06-08')).toBe(false); // yesterday
    expect(isForecastRange('2026-09-05', '2026-06-08')).toBe(false); // months out
  });

  it('priorYearDate shifts back ~a year', () => {
    expect(priorYearDate('2026-09-05')).toBe('2025-09-05');
  });

  it('builds forecast + archive URLs with trimmed coords and the date window', () => {
    const f = forecastUrl(19.6384629, -155.991152, '2026-09-05');
    expect(f).toContain('api.open-meteo.com/v1/forecast');
    expect(f).toContain('latitude=19.638&longitude=-155.991');
    expect(f).toContain('start_date=2026-09-05&end_date=2026-09-05');
    expect(f).toContain('precipitation_probability_max');

    const a = archiveUrl(19.638, -155.991, '2025-09-05');
    expect(a).toContain('archive-api.open-meteo.com/v1/archive');
    expect(a).toContain('start_date=2025-09-05');
  });

  it('normalizeDaily: forecast keeps precip probability', () => {
    const json = {
      daily: {
        temperature_2m_max: [28],
        temperature_2m_min: [22],
        weather_code: [61],
        precipitation_probability_max: [40],
      },
    };
    expect(normalizeDaily(json, '2026-06-10', 'forecast')).toEqual({
      date: '2026-06-10',
      tMaxC: 28,
      tMinC: 22,
      code: 61,
      precipProb: 40,
      source: 'forecast',
    });
  });

  it('normalizeDaily: normal stamps the requested (trip) date + drops precip prob', () => {
    const json = {
      daily: { temperature_2m_max: [27], temperature_2m_min: [21], weather_code: [3] },
    };
    // Archive carries last-year's date in its arrays; we stamp the trip date back.
    expect(normalizeDaily(json, '2026-09-05', 'normal')).toMatchObject({
      date: '2026-09-05',
      tMaxC: 27,
      precipProb: null,
      source: 'normal',
    });
  });

  it('normalizeDaily: returns null when temps are missing', () => {
    expect(normalizeDaily({ daily: { temperature_2m_max: [], temperature_2m_min: [] } }, '2026-09-05', 'forecast')).toBeNull();
    expect(normalizeDaily({}, '2026-09-05', 'forecast')).toBeNull();
  });

  it('weatherCodeInfo maps WMO codes to emoji + label', () => {
    expect(weatherCodeInfo(0).label).toBe('Clear');
    expect(weatherCodeInfo(3).label).toBe('Overcast');
    expect(weatherCodeInfo(61).label).toBe('Rain');
    expect(weatherCodeInfo(95).label).toBe('Thunderstorm');
  });
});
