'use client';

import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { formatMoney } from '@/src/lib/currency';
import { categoryGlyph, thumbForPlace } from '@/src/lib/planUrl';

type PlaceCardProps = {
  place: PlaceDTO;
  pinNumber: number;
  pinColor: string;
  currency: string;
  locale: string;
  /** Offline → swipe actions disabled (mutations are online-only). */
  disabled: boolean;
  onTap: (placeId: string) => void;
  onMoveToSaved: (placeId: string) => void;
  onMoveToDay: (placeId: string) => void;
  onDelete: (placeId: string) => void;
};

export function PlaceCard({
  place,
  pinNumber,
  pinColor,
  currency,
  locale,
  disabled,
  onTap,
  onMoveToSaved,
  onMoveToDay,
  onDelete,
}: PlaceCardProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const thumb = thumbForPlace(place);
  const hasMeta =
    place.scheduledTime != null || place.durationMin != null || place.cost != null;

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
        <span className="mt-1 w-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <div className="mb-3 min-w-0 flex-1 rounded-card bg-card p-3 shadow-card">
        <button
          type="button"
          onClick={() => onTap(place.id)}
          className="flex w-full items-start gap-3 text-left"
        >
          {thumb.kind === 'photo' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.src}
              alt={place.name}
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-control object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-paper text-2xl"
            >
              {thumb.glyph}
            </span>
          )}
          <span className="min-w-0 flex-1">
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
                {place.cost != null ? <span>{formatMoney(place.cost, currency, locale)}</span> : null}
              </span>
            ) : null}
          </span>
        </button>

        <div className="mt-2 flex gap-2 border-t border-line pt-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMoveToSaved(place.id)}
            className="text-caption font-medium text-teal disabled:opacity-40"
          >
            {t('moveToSaved')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onMoveToDay(place.id)}
            className="text-caption font-medium text-teal disabled:opacity-40"
          >
            {t('moveToDay')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDelete(place.id)}
            className="text-caption font-medium text-danger disabled:opacity-40"
          >
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
