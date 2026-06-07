'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { categoryGlyph, thumbForPlace } from '@/src/lib/planUrl';
import { PhotoPlaceholder } from '@/components/plan/PhotoPlaceholder';

type PlaceCardProps = {
  place: PlaceDTO;
  pinNumber: number;
  pinColor: string;
  /** Offline → management actions disabled (mutations are online-only). */
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onTap: (placeId: string) => void;
  /** Opens the rich read view (works offline). */
  onView: (placeId: string) => void;
  onMoveUp: (placeId: string) => void;
  onMoveDown: (placeId: string) => void;
  onMoveToSaved: (placeId: string) => void;
  /** Reassign this place to another day (opens a day picker). */
  onMoveToDay: (placeId: string) => void;
  /** Duplicate this place onto another day (opens a day picker). */
  onCopyToDay: (placeId: string) => void;
  onDelete: (placeId: string) => void;
};

export function PlaceCard({
  place,
  pinNumber,
  pinColor,
  disabled,
  isFirst,
  isLast,
  onTap,
  onView,
  onMoveUp,
  onMoveDown,
  onMoveToSaved,
  onMoveToDay,
  onCopyToDay,
  onDelete,
}: PlaceCardProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const thumb = thumbForPlace(place);
  const [managing, setManaging] = useState(false);
  const hasMeta = place.scheduledTime != null || place.durationMin != null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-caption font-bold text-white"
          style={{ backgroundColor: pinColor }}
        >
          {pinNumber}
        </span>
        <div className="mt-1 flex flex-col gap-0.5">
          <button
            type="button"
            aria-label={t('moveUp')}
            disabled={disabled || isFirst}
            onClick={() => onMoveUp(place.id)}
            className="text-ink-faint disabled:opacity-30"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={t('moveDown')}
            disabled={disabled || isLast}
            onClick={() => onMoveDown(place.id)}
            className="text-ink-faint disabled:opacity-30"
          >
            ▼
          </button>
        </div>
        <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <div className="mb-3 min-w-0 flex-1 rounded-card bg-card p-3 shadow-card">
        <button
          type="button"
          onClick={() => onTap(place.id)}
          className="block w-full text-left"
        >
          {thumb.kind === 'photo' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.src}
              alt={place.name}
              className="mb-2 h-40 w-full rounded-control object-cover"
            />
          ) : (
            <PhotoPlaceholder category={place.category} />
          )}
          <span className="block min-w-0">
            <span className="flex items-center gap-1">
              <span aria-hidden="true">{categoryGlyph(place.category)}</span>
              <span className="truncate text-body font-bold text-ink">{place.name}</span>
            </span>
            <span className="block truncate text-caption text-ink-muted">
              {tCat(place.category)}
              {place.address ? ` · ${place.address}` : ''}
            </span>
            {hasMeta ? (
              <span className="mt-1 flex flex-wrap gap-2 text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
                {place.scheduledTime ? <span>{place.scheduledTime}</span> : null}
                {place.durationMin != null ? <span>{place.durationMin} min</span> : null}
              </span>
            ) : null}
          </span>
        </button>

        <div className="mt-2 flex flex-wrap gap-2 border-t border-line pt-2">
          {/* View is enabled even offline — opens local read card */}
          <button
            type="button"
            onClick={() => onView(place.id)}
            className="rounded-control border border-teal px-2.5 py-1 text-caption font-medium text-teal active:bg-teal-tint"
          >
            {t('view')}
          </button>
          {/* Manage groups the secondary actions to keep the card clean */}
          <button
            type="button"
            aria-expanded={managing}
            onClick={() => setManaging((v) => !v)}
            className="rounded-control border border-line px-2.5 py-1 text-caption font-medium text-ink-muted active:bg-line"
          >
            {t('manage')}
          </button>
        </div>

        {managing ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onMoveToSaved(place.id)}
              className="rounded-control border border-teal px-2.5 py-1 text-caption font-medium text-teal disabled:opacity-40"
            >
              {t('moveToSaved')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onMoveToDay(place.id)}
              className="rounded-control border border-teal px-2.5 py-1 text-caption font-medium text-teal disabled:opacity-40"
            >
              {t('move')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onCopyToDay(place.id)}
              className="rounded-control border border-teal px-2.5 py-1 text-caption font-medium text-teal disabled:opacity-40"
            >
              {t('copy')}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onDelete(place.id)}
              className="rounded-control border border-danger px-2.5 py-1 text-caption font-medium text-danger disabled:opacity-40"
            >
              {t('delete')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
