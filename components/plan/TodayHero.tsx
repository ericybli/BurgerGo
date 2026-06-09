'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import type { LegLookup } from '@/src/lib/legView';
import { legBetween, formatLeg, nextStopIndex } from '@/src/lib/legView';
import { categoryGlyph } from '@/src/lib/planUrl';

type TodayHeroProps = {
  stops: PlaceDTO[]; // today's day, ordered by orderIndex
  legs: LegLookup;
  mode: TravelMode;
  /** Current wall-clock "HH:MM" in the trip TZ (PlanClient injects it). */
  nowHHMM: string;
};

/** Stable signature of the day's stop set; the pointer resets when it changes. */
function stopSignature(stops: PlaceDTO[]): string {
  return stops.map((s) => s.id).join('|');
}

export function TodayHero({ stops, legs, mode, nowHHMM }: TodayHeroProps) {
  const t = useTranslations('plan');
  const signature = stopSignature(stops);

  // Transient, client-only pointer (spec §3.6): plain useState (resets on reload),
  // re-seeded to the default via an effect keyed on the stable stop-id signature —
  // never set during render, never persisted, no schema field.
  const [index, setIndex] = useState(() => nextStopIndex(stops, nowHHMM));
  useEffect(() => {
    setIndex(nextStopIndex(stops, nowHHMM));
    // Keyed on the stop set only; recompute on add/reorder/delete, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (stops.length === 0 || index < 0 || index >= stops.length) return null;

  const stop = stops[index]!;
  const prev = stops[index - 1];
  // The incoming leg uses this stop's own mode (or the day default).
  const leg = prev ? legBetween(legs, prev.id, stop.id, stop.legMode ?? mode) : undefined;
  const canSkip = index < stops.length - 1;

  const href = placeUrl({
    name: stop.name,
    lat: stop.lat ?? 0,
    lng: stop.lng ?? 0,
    googlePlaceId: stop.googlePlaceId,
  });

  return (
    <section
      aria-label={t('upNext')}
      className="relative mb-4 overflow-hidden rounded-card bg-coral p-4 text-white shadow-lift"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl"
      />
      <p className="relative text-micro font-semibold uppercase tracking-[0.14em] opacity-90">{t('upNext')}</p>
      <div className="relative mt-1.5 flex items-center gap-2">
        <span aria-hidden="true" className="text-xl">{categoryGlyph(stop.category)}</span>
        <h2 className="min-w-0 flex-1 truncate font-serif text-title font-bold">{stop.name}</h2>
      </div>
      <div className="relative mt-1.5 flex flex-wrap gap-3 text-caption opacity-90 [font-variant-numeric:tabular-nums]">
        <span>{stop.scheduledTime ?? t('noTimeSet')}</span>
        {prev ? <span>{formatLeg(leg)}</span> : null}
      </div>
      <div className="relative mt-3 flex gap-3">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-control bg-white px-4 py-3 text-center text-label font-bold text-coral shadow-card transition hover:shadow-lift active:scale-[0.98]"
        >
          {t('openInGoogleMaps')}
        </a>
        {canSkip ? (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, stops.length - 1))}
            className="rounded-control bg-coral-press px-4 py-3 text-label font-medium text-white transition hover:bg-coral-press/90 active:scale-[0.98]"
          >
            {t('skip')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
