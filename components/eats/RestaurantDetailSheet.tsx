'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { fetchPoiDetails } from '@/components/plan/googleClient';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import type { DerivedDay } from '@/src/lib/days';
import { priceLevelLabel, ratingStars } from '@/src/lib/eatsView';
import { thumbForRestaurant } from '@/src/lib/planUrl';
import { PhotoGallery } from '@/components/plan/PhotoGallery';
import { usePhotoUpload } from '@/components/plan/usePhotoUpload';
import { deletePhotoAction } from '@/app/_actions/photos';
import {
  updateRestaurantAction,
  deleteRestaurantAction,
  scheduleRestaurantToDayAction,
  unscheduleRestaurantAction,
} from '@/app/_actions/restaurants';

type RestaurantDetailSheetProps = {
  open: boolean;
  restaurant: RestaurantDTO;
  days: DerivedDay[];
  disabled: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (id: string) => void;
};

export function RestaurantDetailSheet({
  open,
  restaurant,
  days,
  disabled,
  onClose,
  onChanged,
  onEdit,
}: RestaurantDetailSheetProps) {
  const t = useTranslations('eats');
  const tPlan = useTranslations('plan');
  const tMapNs = useTranslations('planMap');
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picking, setPicking] = useState(false);
  const { upload, uploading } = usePhotoUpload();
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Clear a stale photo error whenever the sheet opens for a different restaurant.
  useEffect(() => { setPhotoError(null); }, [restaurant.id]);

  // Live Google open-now + freshest hours (online only). Stored googleHours /
  // googleRating remain the offline fallback.
  const [live, setLive] = useState<{ openNow: boolean | null; hours: string[] } | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  useEffect(() => {
    setLive(null);
    setHoursOpen(false);
    if (!open || disabled || !restaurant.googlePlaceId) return;
    let cancelled = false;
    void fetchPoiDetails(restaurant.googlePlaceId).then((d) => {
      if (!cancelled && d) setLive({ openNow: d.openNow, hours: d.hours });
    });
    return () => { cancelled = true; };
  }, [open, disabled, restaurant.id, restaurant.googlePlaceId]);

  if (!open) return null;

  const stars = ratingStars(restaurant.rating);
  const price = priceLevelLabel(restaurant.priceLevel);
  const nextStatus = restaurant.status === 'been' ? 'want-to-try' : 'been';
  const busy = disabled || isPending;
  const thumb = thumbForRestaurant(restaurant);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith('image/')) { setPhotoError(tPlan('photoNotImage')); return; }
    const { photo, errorCode } = await upload({
      file,
      tripId: restaurant.tripId,
      ownerId: restaurant.id,
      ownerType: 'restaurant',
    });
    if (photo) {
      onChanged(); // reload → gallery + card thumb refresh
    } else if (errorCode === 'too_large') {
      setPhotoError(tPlan('photoTooLarge'));
    } else if (errorCode === 'too_many') {
      setPhotoError(tPlan('photoTooMany'));
    } else {
      setPhotoError(tPlan('photoUploadFailed'));
    }
  }

  function handlePhotoDelete(photoId: string) {
    setPhotoError(null);
    startTransition(async () => {
      try {
        await deletePhotoAction(photoId);
        onChanged();
      } catch {
        setPhotoError(tPlan('photoUploadFailed'));
      }
    });
  }

  function run(fn: () => Promise<unknown>) {
    setActionError(null);
    startTransition(async () => {
      try {
        await fn();
        onChanged();
      } catch {
        setActionError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={restaurant.name}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />

        {actionError ? (
          <p role="alert" className="mb-3 rounded-control border border-line px-3 py-2 text-caption text-danger">
            {actionError}
          </p>
        ) : null}

        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{restaurant.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-sub">
          <span>{restaurant.cuisine ?? t('cuisineUnknown')}</span>
          {stars ? (
            <span aria-label={`${restaurant.rating} out of 5`} className="text-accent">
              {'★'.repeat(stars.filled)}<span className="text-line">{'★'.repeat(stars.empty)}</span>
            </span>
          ) : <span>{t('noRating')}</span>}
          {price ? <span className="font-medium text-ink [font-variant-numeric:tabular-nums]">{price}</span> : null}
        </p>
        <p className="mt-1 text-micro uppercase text-accent">
          {restaurant.scheduledDayDate ? t('scheduledOn', { date: restaurant.scheduledDayDate }) : t('notScheduled')}
        </p>

        {(() => {
          // Google place data: persisted rating/hours + live open-now.
          const storedHours: string[] = (() => {
            try {
              const parsed = restaurant.googleHours ? (JSON.parse(restaurant.googleHours) as unknown) : null;
              return Array.isArray(parsed) ? (parsed as string[]) : [];
            } catch {
              return [];
            }
          })();
          const hours = live?.hours.length ? live.hours : storedHours;
          const openNow = live?.openNow ?? null;
          if (restaurant.googleRating == null && hours.length === 0 && openNow == null) return null;
          return (
            <div className="mt-2 rounded-control border border-line px-3 py-2">
              {restaurant.googleRating != null ? (
                <p className="flex items-center gap-1 text-caption text-sub">
                  <Star size={12} strokeWidth={0} className="fill-day-2" aria-hidden="true" />
                  <span className="font-semibold tabular-nums text-ink">{restaurant.googleRating.toFixed(1)}</span>
                  {restaurant.googleRatingCount != null ? (
                    <span className="tabular-nums">· {tMapNs('poiReviewCount', { count: restaurant.googleRatingCount })}</span>
                  ) : null}
                  <span className="text-faint">· Google</span>
                </p>
              ) : null}
              {openNow != null || hours.length > 0 ? (
                <div className={restaurant.googleRating != null ? 'mt-1.5' : ''}>
                  <button
                    type="button"
                    onClick={() => setHoursOpen((v) => !v)}
                    aria-expanded={hoursOpen}
                    disabled={hours.length === 0}
                    className="flex items-center gap-1.5 text-caption font-semibold"
                  >
                    {openNow != null ? (
                      <span className={openNow ? 'text-success' : 'text-danger'}>
                        {openNow ? tMapNs('poiOpenNow') : tMapNs('poiClosed')}
                      </span>
                    ) : (
                      <span className="text-ink">{tMapNs('poiHours')}</span>
                    )}
                    {hours.length > 0 ? (
                      <span aria-hidden="true" className="text-faint">{hoursOpen ? '▴' : '▾'}</span>
                    ) : null}
                  </button>
                  {hoursOpen && hours.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {hours.map((line) => (
                        <li key={line} className="text-caption tabular-nums text-sub">{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })()}

        {restaurant.notes ? <p className="mt-2 text-body text-ink">{restaurant.notes}</p> : null}

        {thumb.kind === 'photo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb.src} alt={restaurant.name} className="mt-3 h-48 w-full rounded-card border border-line object-cover" />
        ) : null}

        {photoError ? (
          <p role="alert" className="mt-3 rounded-control border border-line px-3 py-2 text-caption text-danger">
            {photoError}
          </p>
        ) : null}

        <PhotoGallery
          photos={restaurant.photos}
          placeName={restaurant.name}
          disabled={disabled}
          onDelete={handlePhotoDelete}
        />

        <label className="mt-3 block text-label text-ink" htmlFor="rd-photo">
          {tPlan('addPhoto')}
        </label>
        {disabled ? <p className="text-caption text-sub">{tPlan('addPhotoOffline')}</p> : null}
        <input
          id="rd-photo"
          type="file"
          accept="image/*"
          disabled={disabled || uploading}
          onChange={handlePhotoChange}
          className="mt-1 w-full text-body text-ink disabled:opacity-60"
        />
        {uploading ? (
          <p className="mt-1 text-caption text-sub">{tPlan('uploadingPhoto')}</p>
        ) : null}

        <button
          type="button" disabled={busy}
          onClick={() => run(() => updateRestaurantAction(restaurant.id, { status: nextStatus }))}
          className="mt-4 w-full rounded-[12px] bg-accent px-4 py-3 text-[14px] font-semibold text-white transition active:opacity-80 disabled:opacity-40"
        >
          {restaurant.status === 'been' ? t('markWantToTry') : t('markBeen')}
        </button>

        {picking ? (
          <div className="mt-3">
            <p className="text-label text-ink">{t('dayPickerTitle')}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {days.map((d) => (
                <li key={d.date}>
                  <button
                    type="button" disabled={busy}
                    onClick={() => run(() => scheduleRestaurantToDayAction(restaurant.id, d.date))}
                    className="w-full rounded-control border border-line bg-bg px-3 py-2 text-left text-body text-ink transition hover:bg-surface active:opacity-70 disabled:opacity-40 [font-variant-numeric:tabular-nums]"
                  >
                    Day {d.dayNumber} · {d.weekday} {d.date}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button
            type="button" disabled={busy} onClick={() => setPicking(true)}
            className="mt-3 w-full rounded-control border border-line bg-bg px-4 py-3 text-label text-ink transition hover:bg-surface active:opacity-70 disabled:opacity-40"
          >
            {t('scheduleToDay')}
          </button>
        )}

        {restaurant.scheduledDayDate ? (
          <button
            type="button" disabled={busy}
            onClick={() => run(() => unscheduleRestaurantAction(restaurant.id))}
            className="mt-3 w-full rounded-control border border-line bg-bg px-4 py-3 text-label text-ink transition hover:bg-surface active:opacity-70 disabled:opacity-40"
          >
            {t('unschedule')}
          </button>
        ) : null}

        <button
          type="button" disabled={busy} onClick={() => onEdit(restaurant.id)}
          className="mt-3 w-full rounded-control border border-line bg-bg px-4 py-3 text-label text-ink transition hover:bg-surface active:opacity-70 disabled:opacity-40"
        >
          {t('editRestaurant')}
        </button>

        {confirmingDelete ? (
          <button
            type="button" disabled={busy}
            onClick={() => run(() => deleteRestaurantAction(restaurant.id))}
            className="mt-3 w-full rounded-control bg-danger px-4 py-3 text-label text-white transition active:opacity-80 disabled:opacity-40"
          >
            {t('confirmDelete')}
          </button>
        ) : (
          <button
            type="button" disabled={busy} onClick={() => setConfirmingDelete(true)}
            className="mt-3 w-full rounded-control px-4 py-3 text-label text-danger transition hover:bg-surface active:opacity-70 disabled:opacity-40"
          >
            {t('delete')}
          </button>
        )}

        <button
          type="button" onClick={onClose}
          className="mt-4 w-full rounded-control border border-line bg-bg px-4 py-3 text-label text-ink transition hover:bg-surface active:opacity-70"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
