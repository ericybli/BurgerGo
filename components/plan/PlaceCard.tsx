'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PlaceDTO } from '@/src/lib/planView';
import { thumbForPlace } from '@/src/lib/planUrl';
import { PhotoPlaceholder } from '@/components/plan/PhotoPlaceholder';

type PlaceCardProps = {
  place: PlaceDTO;
  pinNumber: number;
  pinColor: string;
  /** Offline → management actions disabled (mutations are online-only). */
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** Itinerary density: compact hairline rows vs large photo cards. */
  density?: 'rows' | 'cards';
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
  density = 'cards',
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

  const stopNumber = (
    <span
      aria-hidden="true"
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-chip text-[11.5px] font-bold text-white"
      style={{ backgroundColor: pinColor }}
    >
      {pinNumber}
    </span>
  );

  const manageButtons = (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onMoveToSaved(place.id)}
        className="rounded-lg border border-accent px-3 py-1 text-[12.5px] font-semibold text-accent transition hover:bg-accent-tint active:bg-accent-tint active:scale-95 disabled:opacity-40"
      >
        {t('moveToSaved')}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onMoveToDay(place.id)}
        className="rounded-lg border border-accent px-3 py-1 text-[12.5px] font-semibold text-accent transition hover:bg-accent-tint active:bg-accent-tint active:scale-95 disabled:opacity-40"
      >
        {t('move')}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onCopyToDay(place.id)}
        className="rounded-lg border border-accent px-3 py-1 text-[12.5px] font-semibold text-accent transition hover:bg-accent-tint active:bg-accent-tint active:scale-95 disabled:opacity-40"
      >
        {t('copy')}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelete(place.id)}
        className="rounded-lg border border-danger px-3 py-1 text-[12.5px] font-semibold text-danger transition hover:bg-danger/10 active:bg-danger/10 active:scale-95 disabled:opacity-40"
      >
        {t('delete')}
      </button>
    </>
  );

  if (density === 'rows') {
    return (
      <div className={`flex gap-2.5 py-3 ${isLast ? '' : 'border-b border-line'}`}>
        <div className="flex w-6 shrink-0 justify-center pt-4">{stopNumber}</div>

        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onTap(place.id)} className="flex w-full items-center gap-2.5 text-left">
            {thumb.kind === 'photo' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb.src}
                alt={place.name}
                className="h-[54px] w-[54px] shrink-0 rounded-[10px] object-cover"
              />
            ) : (
              <PhotoPlaceholder category={place.category} className="!mb-0 h-[54px] !w-[54px] shrink-0" />
            )}
            <span className="block min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-ink">{place.name}</span>
              <span className="block truncate text-[11.5px] text-sub">
                {tCat(place.category)}
                {place.address ? ` · ${place.address}` : ''}
              </span>
              {hasMeta ? (
                <span className="mt-0.5 flex flex-wrap gap-2 text-[11.5px] text-faint [font-variant-numeric:tabular-nums]">
                  {place.scheduledTime ? <span>{place.scheduledTime}</span> : null}
                  {place.durationMin != null ? <span>{place.durationMin} min</span> : null}
                </span>
              ) : null}
            </span>
          </button>

          <div className="mt-1 flex items-center gap-3 pl-[64px]">
            {/* View is enabled even offline — opens local read card */}
            <button
              type="button"
              onClick={() => onView(place.id)}
              className="py-0.5 text-[12px] font-semibold text-accent transition active:opacity-70"
            >
              {t('view')}
            </button>
            {/* Manage groups the secondary actions to keep the row clean */}
            <button
              type="button"
              aria-expanded={managing}
              onClick={() => setManaging((v) => !v)}
              className="py-0.5 text-[12px] font-semibold text-sub transition active:opacity-70"
            >
              {t('manage')}
            </button>
          </div>

          {managing ? <div className="mt-2 flex flex-wrap gap-2 pl-[64px]">{manageButtons}</div> : null}
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
          <button
            type="button"
            aria-label={t('moveUp')}
            disabled={disabled || isFirst}
            onClick={() => onMoveUp(place.id)}
            className="flex h-6 w-6 items-center justify-center rounded-chip text-faint transition hover:bg-surface active:scale-95 disabled:opacity-30"
          >
            <ChevronUp size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('moveDown')}
            disabled={disabled || isLast}
            onClick={() => onMoveDown(place.id)}
            className="flex h-6 w-6 items-center justify-center rounded-chip text-faint transition hover:bg-surface active:scale-95 disabled:opacity-30"
          >
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <div className="flex w-6 shrink-0 justify-center pt-1">{stopNumber}</div>

      <div className="mb-3 min-w-0 flex-1 overflow-hidden rounded-card border border-line bg-bg">
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
              className="h-[140px] w-full object-cover"
            />
          ) : (
            <PhotoPlaceholder category={place.category} className="!mb-0 h-[140px] !rounded-none" />
          )}
          <span className="block min-w-0 px-3 pt-2.5">
            <span className="block truncate text-heading text-ink">{place.name}</span>
            <span className="block truncate text-caption text-sub">
              {tCat(place.category)}
              {place.address ? ` · ${place.address}` : ''}
            </span>
            {hasMeta ? (
              <span className="mt-1 flex flex-wrap gap-2 text-caption text-faint [font-variant-numeric:tabular-nums]">
                {place.scheduledTime ? <span>{place.scheduledTime}</span> : null}
                {place.durationMin != null ? <span>{place.durationMin} min</span> : null}
              </span>
            ) : null}
          </span>
        </button>

        <div className="mt-2.5 flex items-center gap-2 px-3 pb-3">
          {/* View is enabled even offline — opens local read card */}
          <button
            type="button"
            onClick={() => onView(place.id)}
            className="rounded-lg border border-accent px-3 py-1 text-[12.5px] font-semibold text-accent transition hover:bg-accent-tint active:bg-accent-tint active:scale-95"
          >
            {t('view')}
          </button>
          {/* Manage groups the secondary actions to keep the card clean */}
          <button
            type="button"
            aria-expanded={managing}
            onClick={() => setManaging((v) => !v)}
            className="rounded-lg border border-line px-3 py-1 text-[12.5px] font-semibold text-sub transition hover:bg-surface active:bg-surface active:scale-95"
          >
            {t('manage')}
          </button>
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label={t('moveUp')}
              disabled={disabled || isFirst}
              onClick={() => onMoveUp(place.id)}
              className="flex h-7 w-7 items-center justify-center rounded-chip text-faint transition hover:bg-surface active:scale-95 disabled:opacity-30"
            >
              <ChevronUp size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t('moveDown')}
              disabled={disabled || isLast}
              onClick={() => onMoveDown(place.id)}
              className="flex h-7 w-7 items-center justify-center rounded-chip text-faint transition hover:bg-surface active:scale-95 disabled:opacity-30"
            >
              <ChevronDown size={13} aria-hidden="true" />
            </button>
          </span>
        </div>

        {managing ? <div className="flex flex-wrap gap-2 px-3 pb-3">{manageButtons}</div> : null}
      </div>
    </div>
  );
}
