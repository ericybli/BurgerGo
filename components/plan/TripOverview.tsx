'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { placesForDay } from '@/src/lib/planView';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { categoryGlyph } from '@/src/lib/planUrl';
import { nextStopIndex } from '@/src/lib/legView';
import { tripStatus, today as todayIn, diffDays, type DerivedDay } from '@/src/lib/days';
import { weatherCodeInfo, type DayWeather } from '@/src/lib/weather';
import { withBase } from '@/src/lib/basePath';

const LODGING = new Set<PlaceDTO['category']>(['lodging', 'hotel', 'airbnb']);
const STORAGE_KEY = 'burgergo.overview.collapsed';

/** "Sat, Sep 5" — UTC-stable so the weekday/date never shift with the host TZ. */
function shortDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateStr}T00:00:00Z`));
}

type TripOverviewProps = {
  tripId: string;
  trip: { startDate: string; endDate: string };
  tz: string;
  days: DerivedDay[];
  places: PlaceDTO[];
  /** Current "HH:MM" in the trip TZ — for picking the next upcoming stop today. */
  nowHHMM: string;
  onViewPlace: (id: string) => void;
};

/**
 * Collapsible "trip at a glance" panel at the top of the Plan tab (F1). Default
 * collapsed (persisted in localStorage); collapsed shows a one-line summary, expanded
 * shows the relevant day's weekday/date, weather, next stop, the day's plan, and the
 * day's lodging. The "relevant day" is today while the trip is active, the first day
 * before it starts (with a countdown), and the last day after it ends. Pure Plan data
 * + a weather fetch — no cross-section coupling.
 */
export function TripOverview({ tripId, trip, tz, days, places, nowHHMM, onViewPlace }: TripOverviewProps) {
  const t = useTranslations('plan');

  // Relevant day (pure; safe even if days is somehow empty).
  const status = days.length ? tripStatus(trip, tz) : 'upcoming';
  const relevant: DerivedDay | null = !days.length
    ? null
    : status === 'active'
      ? (days.find((d) => d.isToday) ?? days[0]!)
      : status === 'upcoming'
        ? days[0]!
        : days[days.length - 1]!;
  const relevantDate = relevant?.date ?? '';

  // Hooks run unconditionally (before any early return).
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) !== '0');
    } catch {
      /* private mode / no storage → stay collapsed */
    }
  }, []);

  const [weather, setWeather] = useState<DayWeather | null>(null);
  useEffect(() => {
    if (!relevantDate) return;
    let cancelled = false;
    setWeather(null);
    fetch(withBase(`/api/trips/${tripId}/weather?date=${relevantDate}`), { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) setWeather((j.weather as DayWeather | null) ?? null);
      })
      .catch(() => {
        /* offline / upstream down → no weather row */
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, relevantDate]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!relevant) return null;

  const stops = placesForDay(places, relevant.date);
  const nextStop = stops[relevant.isToday ? nextStopIndex(stops, nowHHMM) : 0];
  const hotel = stops.find((s) => LODGING.has(s.category));
  const daysToStart = status === 'upcoming' ? diffDays(todayIn(tz), trip.startDate) : 0;

  const wInfo = weather ? weatherCodeInfo(weather.code) : null;
  const dayHeading = `${t('overviewDayLabel', { n: relevant.dayNumber })} · ${shortDate(relevant.date)}`;

  return (
    <section className="mb-3 overflow-hidden rounded-card bg-card shadow-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span aria-hidden="true" className="text-ink-muted">{collapsed ? '▸' : '▾'}</span>
        <span className="text-label font-semibold text-ink">{t('overview')}</span>
        {collapsed ? (
          <span className="ml-1 min-w-0 flex-1 truncate text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
            {dayHeading}
            {wInfo ? ` · ${wInfo.emoji} ${Math.round(weather!.tMaxC)}°` : ''}
          </span>
        ) : null}
      </button>

      {collapsed ? null : (
        <div className="space-y-2 px-4 pb-3 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-body font-semibold text-ink [font-variant-numeric:tabular-nums]">{dayHeading}</span>
            {status === 'upcoming' && daysToStart > 0 ? (
              <span className="shrink-0 text-caption text-ink-muted">{t('overviewStartsIn', { days: daysToStart })}</span>
            ) : null}
          </div>

          {weather && wInfo ? (
            <p className="text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
              {wInfo.emoji} {Math.round(weather.tMaxC)}°/{Math.round(weather.tMinC)}° {wInfo.label}
              {weather.precipProb != null && weather.precipProb > 0 ? ` · ${weather.precipProb}% ${t('overviewRain')}` : ''}
              {weather.source === 'normal' ? ` · ${t('overviewTypical')}` : ''}
            </p>
          ) : null}

          {nextStop ? (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-caption font-semibold uppercase tracking-wide text-coral">{t('upNext')}</span>
              <button
                type="button"
                onClick={() => onViewPlace(nextStop.id)}
                className="min-w-0 flex-1 truncate text-left text-body text-ink"
              >
                <span aria-hidden="true" className="mr-1">{categoryGlyph(nextStop.category)}</span>
                {nextStop.scheduledTime ? (
                  <span className="mr-1 text-ink-muted [font-variant-numeric:tabular-nums]">{nextStop.scheduledTime}</span>
                ) : null}
                {nextStop.name}
              </button>
              <a
                href={placeUrl({ name: nextStop.name, lat: nextStop.lat ?? 0, lng: nextStop.lng ?? 0, googlePlaceId: nextStop.googlePlaceId })}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('openInGoogleMaps')}
                className="shrink-0 px-1 text-teal"
              >
                ↗
              </a>
            </div>
          ) : null}

          {hotel ? (
            <button
              type="button"
              onClick={() => onViewPlace(hotel.id)}
              className="flex w-full items-center gap-2 text-left"
            >
              <span aria-hidden="true">🛏</span>
              <span className="shrink-0 text-caption text-ink-muted">{t('overviewHotel')}</span>
              <span className="min-w-0 flex-1 truncate text-body text-ink">{hotel.name}</span>
            </button>
          ) : null}

          {stops.length > 0 ? (
            <div>
              <p className="text-caption font-semibold text-ink-muted">{t('overviewDayPlan')}</p>
              <ol className="mt-1 space-y-0.5">
                {stops.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onViewPlace(s.id)}
                      className="flex w-full items-center gap-2 py-0.5 text-left text-caption"
                    >
                      <span className="w-10 shrink-0 text-ink-muted [font-variant-numeric:tabular-nums]">{s.scheduledTime ?? ''}</span>
                      <span aria-hidden="true">{categoryGlyph(s.category)}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{s.name}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-caption text-ink-muted">{t('overviewNoStops')}</p>
          )}
        </div>
      )}
    </section>
  );
}
