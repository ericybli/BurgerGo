'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { poiPhotoUrl, type PoiDetails } from '@/components/plan/googleClient';

/** Which save action completed (drives the ✓ label + disables the buttons). */
export type PoiAddedKind = 'saved' | 'day' | 'restaurant' | null;

export type PoiPreview =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; details: PoiDetails; added: PoiAddedKind; saving: boolean };

/**
 * Info card for a tapped Google basemap landmark (POI): swipeable photo
 * gallery, name, rating + review count, address, editorial summary, open-now +
 * weekday hours, top reviews, an "Add to places" action (saves into the trip's
 * Saved bucket), and an Open-in-Google-Maps link. Presentational; the parent
 * owns state/handlers and keys this card by place id (resets the pager).
 */
export function PoiInfoCard({
  preview,
  online,
  onSavePlace,
  onAddToDay,
  onSaveRestaurant,
  onClose,
}: {
  preview: PoiPreview;
  online: boolean;
  /** Save into the trip's Saved bucket (non-dining POIs). */
  onSavePlace: () => void;
  /** Open the day picker, then add to that day (non-dining POIs). */
  onAddToDay: () => void;
  /** Save into Eats as want-to-try (dining POIs). */
  onSaveRestaurant: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('planMap');
  const [photoIdx, setPhotoIdx] = useState(0);
  const [hoursOpen, setHoursOpen] = useState(false);

  return (
    <div className="pointer-events-auto max-h-[70vh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-card border border-line bg-bg p-3">
      {preview.status === 'loading' ? (
        <p className="px-1 py-2 text-body text-sub">{t('poiLoading')}</p>
      ) : preview.status === 'error' ? (
        <p className="px-1 py-2 text-body text-danger">{t('poiFailed')}</p>
      ) : (
        <>
          {preview.details.photoRefs.length > 0 ? (
            <div className="relative mb-3 overflow-hidden rounded-[14px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={poiPhotoUrl(preview.details.photoRefs[photoIdx] ?? preview.details.photoRefs[0]!)}
                alt={preview.details.name ?? ''}
                className="h-[165px] w-full bg-surface object-cover"
              />
              {preview.details.photoRefs.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label={t('poiPhotoPrev')}
                    onClick={() =>
                      setPhotoIdx((i) => (i - 1 + preview.details.photoRefs.length) % preview.details.photoRefs.length)
                    }
                    className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-chip bg-bg/90 text-ink shadow-lift backdrop-blur active:scale-95"
                  >
                    <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('poiPhotoNext')}
                    onClick={() => setPhotoIdx((i) => (i + 1) % preview.details.photoRefs.length)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-chip bg-bg/90 text-ink shadow-lift backdrop-blur active:scale-95"
                  >
                    <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
                  </button>
                  <span className="absolute bottom-2 right-2 rounded-chip bg-ink/70 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-white">
                    {photoIdx + 1}/{preview.details.photoRefs.length}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold text-ink">
                {preview.details.name ?? preview.details.address ?? t('poiCardLabel')}
              </h3>
              {preview.details.rating != null ? (
                <p className="mt-0.5 flex items-center gap-1 text-caption text-sub">
                  <Star size={12} strokeWidth={0} className="fill-day-2" aria-hidden="true" />
                  <span className="font-semibold tabular-nums text-ink">{preview.details.rating.toFixed(1)}</span>
                  {preview.details.ratingCount != null ? (
                    <span className="tabular-nums">
                      · {t('poiReviewCount', { count: preview.details.ratingCount })}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {preview.details.address ? (
                <p className="mt-0.5 text-caption text-sub">{preview.details.address}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t('closeInfoCard')}
              onClick={onClose}
              className="-mr-1 -mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-chip bg-surface text-sub transition hover:bg-line active:scale-95"
            >
              ✕
            </button>
          </div>

          {preview.details.summary ? (
            <p className="mt-2 text-[13px] leading-[19px] text-ink">{preview.details.summary}</p>
          ) : null}

          {preview.details.openNow != null || preview.details.hours.length > 0 ? (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setHoursOpen((v) => !v)}
                aria-expanded={hoursOpen}
                disabled={preview.details.hours.length === 0}
                className="flex items-center gap-1.5 text-caption font-semibold"
              >
                {preview.details.openNow != null ? (
                  <span className={preview.details.openNow ? 'text-success' : 'text-danger'}>
                    {preview.details.openNow ? t('poiOpenNow') : t('poiClosed')}
                  </span>
                ) : (
                  <span className="text-ink">{t('poiHours')}</span>
                )}
                {preview.details.hours.length > 0 ? (
                  <span aria-hidden="true" className="text-faint">
                    {hoursOpen ? '▴' : '▾'}
                  </span>
                ) : null}
              </button>
              {hoursOpen && preview.details.hours.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {preview.details.hours.map((line) => (
                    <li key={line} className="text-caption tabular-nums text-sub">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {preview.details.reviews.length > 0 ? (
            <div className="mt-3">
              <p className="text-micro uppercase text-faint">{t('poiReviews')}</p>
              <ul className="mt-1.5 space-y-2.5">
                {preview.details.reviews.map((rv, i) => (
                  <li key={`${rv.author}-${i}`} className="border-b border-line pb-2.5 last:border-b-0 last:pb-0">
                    <p className="flex items-center gap-1.5 text-caption">
                      <span className="font-semibold text-ink">{rv.author}</span>
                      {rv.rating != null ? (
                        <span className="flex items-center gap-0.5 tabular-nums text-sub">
                          <Star size={10} strokeWidth={0} className="fill-day-2" aria-hidden="true" />
                          {rv.rating}
                        </span>
                      ) : null}
                      {rv.time ? <span className="text-faint">· {rv.time}</span> : null}
                    </p>
                    <p className="mt-0.5 line-clamp-4 text-[12.5px] leading-[18px] text-sub">{rv.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.details.isFood ? (
            <button
              type="button"
              disabled={!online || preview.added != null || preview.saving}
              onClick={onSaveRestaurant}
              className="mt-3 block w-full rounded-control bg-orange px-3 py-2 text-center text-label text-white transition hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
            >
              {preview.added === 'restaurant'
                ? t('poiAddedRestaurant')
                : preview.saving
                  ? t('poiSaving')
                  : t('poiSaveRestaurant')}
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!online || preview.added != null || preview.saving}
                onClick={onAddToDay}
                className="flex-1 rounded-control bg-orange px-3 py-2 text-center text-label text-white transition hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
              >
                {preview.added === 'day' ? t('poiAddedDay') : preview.saving ? t('poiSaving') : t('poiAddToDay')}
              </button>
              <button
                type="button"
                disabled={!online || preview.added != null || preview.saving}
                onClick={onSavePlace}
                className="flex-1 rounded-control border border-line bg-bg px-3 py-2 text-center text-label text-ink transition hover:bg-surface active:opacity-70 disabled:bg-surface disabled:text-faint"
              >
                {preview.added === 'saved' ? t('poiAdded') : t('poiSavePlace')}
              </button>
            </div>
          )}
          {typeof preview.details.lat === 'number' && typeof preview.details.lng === 'number' ? (
            <a
              href={placeUrl({
                name: preview.details.name ?? '',
                lat: preview.details.lat,
                lng: preview.details.lng,
                googlePlaceId: preview.details.googlePlaceId,
                address: preview.details.address,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full rounded-control bg-accent px-3 py-2 text-center text-label text-white transition hover:opacity-90 active:opacity-80"
            >
              {t('openInMaps')}
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}
