'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

  function move(placeId: string, dir: 'up' | 'down') {
    const ids = stops.map((s) => s.id);
    const from = ids.indexOf(placeId);
    const to = dir === 'up' ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= ids.length) return;
    onReorder(reorderIds(ids, from, to));
  }

  return (
    <div>
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
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={onAddPlace}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card transition hover:bg-coral-press hover:shadow-lift active:scale-[0.98] active:bg-coral-press disabled:opacity-40"
          >
            {t('addPlace')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddFromSaved}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset transition hover:bg-line active:scale-[0.98] active:bg-line disabled:opacity-40"
          >
            {t('addFromSaved')}
          </button>
        </div>
      ) : disabled ? null : (
        <div className="mt-2 text-center">
          <button type="button" onClick={onAddFromSaved} className="rounded-control px-2 py-1 text-label font-medium text-teal transition hover:bg-teal-tint active:scale-95">
            {t('addFromSaved')}
          </button>
        </div>
      )}

      {stops.length > 0 ? (
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          className="mt-2 w-full rounded-control border border-line px-4 py-2 text-caption font-medium text-ink-muted transition hover:bg-line active:bg-line active:scale-[0.99]"
        >
          {t('exportDay')}
        </button>
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
