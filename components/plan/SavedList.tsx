'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import type { DerivedDay } from '@/src/lib/days';
import { categoryGlyph, thumbForPlace } from '@/src/lib/planUrl';
import { EmptyState } from '@/components/EmptyState';
import { DayPickerSheet } from '@/components/plan/DayPickerSheet';

type SavedListProps = {
  saved: PlaceDTO[];
  days: DerivedDay[];
  disabled: boolean;
  onPromote: (placeId: string, date: string) => void;
  onTapPlace: (placeId: string) => void;
  onAddPlace: () => void;
};

export function SavedList({
  saved,
  days,
  disabled,
  onPromote,
  onTapPlace,
  onAddPlace,
}: SavedListProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  if (saved.length === 0) {
    return (
      <EmptyState
        mascotAlt={t('addPlace')}
        headline={t('emptySavedHeadline')}
        subtext={t('emptySavedSubtext')}
        actionLabel={disabled ? undefined : t('addPlace')}
        onAction={disabled ? undefined : onAddPlace}
      />
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-3">
        {saved.map((p) => {
          const thumb = thumbForPlace(p);
          return (
            <li key={p.id} className="rounded-card bg-card p-3 shadow-card">
              <button
                type="button"
                onClick={() => onTapPlace(p.id)}
                className="block w-full text-left"
              >
                {thumb.kind === 'photo' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb.src}
                    alt={p.name}
                    className="mb-2 h-40 w-full rounded-control object-cover"
                  />
                ) : null}
                <span className="block min-w-0">
                  <span className="flex items-center gap-1">
                    <span aria-hidden="true">{categoryGlyph(p.category)}</span>
                    <span className="truncate text-body font-bold text-ink">{p.name}</span>
                  </span>
                  <span className="block truncate text-caption text-ink-muted">
                    {tCat(p.category)}
                    {p.address ? ` · ${p.address}` : ''}
                  </span>
                  {p.notes ? (
                    <span className="mt-1 block truncate text-caption text-ink-muted">{p.notes}</span>
                  ) : null}
                </span>
              </button>

              <button
                type="button"
                disabled={disabled}
                onClick={() => setPickerFor(p.id)}
                className="mt-2 w-full rounded-control bg-coral px-4 py-2 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
              >
                {t('addToDay')}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={disabled}
        onClick={onAddPlace}
        className="mt-3 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
      >
        {t('addPlace')}
      </button>

      <DayPickerSheet
        open={pickerFor !== null}
        title={t('dayPickerTitle')}
        days={days}
        onPick={(date) => {
          if (pickerFor) onPromote(pickerFor, date);
        }}
        onClose={() => setPickerFor(null)}
      />
    </div>
  );
}
