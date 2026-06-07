'use client';

import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import type { LegLookup } from '@/src/lib/legView';
import { legBetween } from '@/src/lib/legView';
import { pinLabel } from '@/src/lib/planView';
import { EmptyState } from '@/components/EmptyState';
import { PlaceCard } from '@/components/plan/PlaceCard';
import { LegConnector } from '@/components/plan/LegConnector';
import { DayModeControl } from '@/components/plan/DayModeControl';

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
  stops: PlaceDTO[]; // already ordered by orderIndex
  legs: LegLookup;
  mode: TravelMode;
  dayColor: string;
  disabled: boolean;
  onAddPlace: () => void;
  onAddFromSaved: () => void;
  onReorder: (orderedIds: string[]) => void;
  onTapPlace: (placeId: string) => void;
  onViewPlace: (placeId: string) => void;
  onMoveToSaved: (placeId: string) => void;
  onMoveToDay: (placeId: string) => void;
  onCopyToDay: (placeId: string) => void;
  onDelete: (placeId: string) => void;
  onModeChange: (mode: TravelMode) => void;
  onRecompute: () => void;
};

export function DayItinerary({
  dayLabel,
  stops,
  legs,
  mode,
  dayColor,
  disabled,
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
  onRecompute,
}: DayItineraryProps) {
  const t = useTranslations('plan');

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
                {prev ? <LegConnector leg={legBetween(legs, prev.id, stop.id, mode)} /> : null}
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
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('addPlace')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onAddFromSaved}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
          >
            {t('addFromSaved')}
          </button>
        </div>
      ) : disabled ? null : (
        <div className="mt-2 text-center">
          <button type="button" onClick={onAddFromSaved} className="text-label font-medium text-teal">
            {t('addFromSaved')}
          </button>
        </div>
      )}
    </div>
  );
}
