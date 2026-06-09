'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Rows3 } from 'lucide-react';
import type { PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import type { LegLookup } from '@/src/lib/legView';
import { legBetween } from '@/src/lib/legView';
import { pinLabel } from '@/src/lib/planView';
import { formatDayItinerary } from '@/src/lib/exportDay';
import { EmptyState } from '@/components/EmptyState';
import { PlaceCard } from '@/components/plan/PlaceCard';
import { LegConnector } from '@/components/plan/LegConnector';
import { DayModeControl } from '@/components/plan/DayModeControl';
import { ExportDaySheet } from '@/components/plan/ExportDaySheet';

/** Pure reorder: move the item at `from` to `to`, preserving the rest. */
export function reorderIds(ids: string[], from: number, to: number): string[] {
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return ids;
  next.splice(to, 0, moved);
  return next;
}

type DayItineraryProps = {
  dayLabel: string;
  /** The day's calendar date (YYYY-MM-DD), used in the text export header. */
  dayDate: string;
  stops: PlaceDTO[]; // already ordered by orderIndex
  legs: LegLookup;
  mode: TravelMode;
  dayColor: string;
  disabled: boolean;
  /** Online → a missing leg means Google had no route; offline → reconnect to compute. */
  online: boolean;
  onAddPlace: () => void;
  onAddFromSaved: () => void;
  onReorder: (orderedIds: string[]) => void;
  onTapPlace: (placeId: string) => void;
  onViewPlace: (placeId: string) => void;
  onMoveToSaved: (placeId: string) => void;
  onMoveToDay: (placeId: string) => void;
  onCopyToDay: (placeId: string) => void;
  onDelete: (placeId: string) => void;
  /** Day default mode change (top toggle). */
  onModeChange: (mode: TravelMode) => void;
  /** Per-leg mode change: sets the mode of the leg arriving at `placeId`. */
  onLegModeChange: (placeId: string, mode: TravelMode) => void;
  onRecompute: () => void;
};

export function DayItinerary({
  dayLabel,
  dayDate,
  stops,
  legs,
  mode,
  dayColor,
  disabled,
  online,
  onAddPlace,
  onAddFromSaved,
  onReorder,
  onTapPlace,
  onViewPlace,
  onMoveToSaved,
  onMoveToDay,
  onCopyToDay,
  onDelete,
  onModeChange,
  onLegModeChange,
  onRecompute,
}: DayItineraryProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const [exportOpen, setExportOpen] = useState(false);
  // Itinerary density (approved Atlas affordance): compact rows vs large cards,
  // remembered across visits. localStorage is only touched post-mount (SSR-safe).
  const [density, setDensity] = useState<'rows' | 'cards'>('rows');
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('bg.itineraryDensity');
      if (stored === 'rows' || stored === 'cards') setDensity(stored);
    } catch {
      /* private mode etc. — keep the default */
    }
  }, []);
  function changeDensity(next: 'rows' | 'cards') {
    setDensity(next);
    try {
      window.localStorage.setItem('bg.itineraryDensity', next);
    } catch {
      /* ignore — preference just won't persist */
    }
  }

  function move(placeId: string, dir: 'up' | 'down') {
    const ids = stops.map((s) => s.id);
    const from = ids.indexOf(placeId);
    const to = dir === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return;
    onReorder(reorderIds(ids, from, to));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-ink">{dayLabel}</span>
        <div role="group" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-surface p-[2px]">
          <button
            type="button"
            aria-label={t('densityRows')}
            aria-pressed={density === 'rows'}
            onClick={() => changeDensity('rows')}
            className={`rounded-md px-[7px] py-[3px] transition ${
              density === 'rows' ? 'bg-bg text-ink shadow-thumb' : 'text-faint'
            }`}
          >
            <Rows3 size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('densityCards')}
            aria-pressed={density === 'cards'}
            onClick={() => changeDensity('cards')}
            className={`rounded-md px-[7px] py-[3px] transition ${
              density === 'cards' ? 'bg-bg text-ink shadow-thumb' : 'text-faint'
            }`}
          >
            <LayoutGrid size={13} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <DayModeControl mode={mode} disabled={disabled} onChange={onModeChange} onRecompute={onRecompute} />
      </div>

      {stops.length === 0 ? (
        <EmptyState
          mascotAlt={t('addPlace')}
          headline={t('emptyDayHeadline', { dayLabel })}
          subtext={t('emptyDaySubtext')}
          actionLabel={disabled ? undefined : t('addPlace')}
          onAction={disabled ? undefined : onAddPlace}
        />
      ) : (
        <ol>
          {stops.map((stop, i) => {
            const prev = stops[i - 1];
            return (
              <li key={stop.id}>
                {prev ? (
                  <LegConnector
                    leg={legBetween(legs, prev.id, stop.id, stop.legMode ?? mode)}
                    mode={stop.legMode ?? mode}
                    disabled={disabled}
                    online={online}
                    onModeChange={(m) => onLegModeChange(stop.id, m)}
                  />
                ) : null}
                <PlaceCard
                  place={stop}
                  pinNumber={pinLabel(stop)}
                  pinColor={dayColor}
                  density={density}
                  disabled={disabled}
                  isFirst={i === 0}
                  isLast={i === stops.length - 1}
                  onTap={onTapPlace}
                  onView={onViewPlace}
                  onMoveUp={(id) => move(id, 'up')}
                  onMoveDown={(id) => move(id, 'down')}
                  onMoveToSaved={onMoveToSaved}
                  onMoveToDay={onMoveToDay}
                  onCopyToDay={onCopyToDay}
                  onDelete={onDelete}
                />
              </li>
            );
          })}
        </ol>
      )}

      {stops.length > 0 ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={onAddPlace}
            className="flex-1 rounded-[12px] bg-orange px-4 py-[11px] text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
          >
            {t('addPlace')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddFromSaved}
            className="flex-1 rounded-[12px] border border-line bg-bg px-4 py-[11px] text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70 disabled:opacity-40"
          >
            {t('addFromSaved')}
          </button>
        </div>
      ) : disabled ? null : (
        <div className="mt-2 text-center">
          <button type="button" onClick={onAddFromSaved} className="rounded-control px-2 py-1 text-label text-accent transition hover:bg-accent-tint active:opacity-70">
            {t('addFromSaved')}
          </button>
        </div>
      )}

      {stops.length > 0 ? (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="px-3 py-1.5 text-[12px] font-semibold text-sub transition active:opacity-70"
          >
            {t('exportDay')}
          </button>
        </div>
      ) : null}

      {exportOpen ? (
        <ExportDaySheet
          text={formatDayItinerary(
            `${dayLabel} · ${dayDate}`,
            stops.map((s) => ({ name: s.name, category: tCat(s.category), time: s.scheduledTime, address: s.address })),
          )}
          onClose={() => setExportOpen(false)}
        />
      ) : null}
    </div>
  );
}
