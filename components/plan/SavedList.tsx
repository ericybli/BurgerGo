'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import type { DerivedDay } from '@/src/lib/days';
import { categoryGlyph, thumbForPlace } from '@/src/lib/planUrl';
import { EmptyState } from '@/components/EmptyState';

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
                className="flex w-full items-start gap-3 text-left"
              >
                {thumb.kind === 'photo' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb.src}
                    alt={p.name}
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

      {pickerFor ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('dayPickerTitle')}
          className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
          onClick={() => setPickerFor(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setPickerFor(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[70vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
          >
            <h2 className="mb-3 text-title font-bold text-ink">{t('dayPickerTitle')}</h2>
            <ul className="flex flex-col gap-2">
              {days.map((d) => (
                <li key={d.date}>
                  <button
                    type="button"
                    onClick={() => {
                      onPromote(pickerFor, d.date);
                      setPickerFor(null);
                    }}
                    className="w-full rounded-control bg-paper px-4 py-3 text-left text-body font-medium text-ink shadow-inset"
                  >
                    {`Day ${d.dayNumber} · ${d.weekday.slice(0, 3)}`}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
