'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import type { DerivedDay } from '@/src/lib/days';
import { priceLevelLabel, ratingStars } from '@/src/lib/eatsView';
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
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picking, setPicking] = useState(false);

  if (!open) return null;

  const stars = ratingStars(restaurant.rating);
  const price = priceLevelLabel(restaurant.priceLevel);
  const nextStatus = restaurant.status === 'been' ? 'want-to-try' : 'been';
  const busy = disabled || isPending;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
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
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        {actionError ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {actionError}
          </p>
        ) : null}

        <h2 className="text-title font-bold text-ink">{restaurant.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
          <span>{restaurant.cuisine ?? t('cuisineUnknown')}</span>
          {stars ? (
            <span aria-label={`${restaurant.rating} out of 5`} className="text-coral">
              {'★'.repeat(stars.filled)}<span className="text-line">{'★'.repeat(stars.empty)}</span>
            </span>
          ) : <span>{t('noRating')}</span>}
          {price ? <span className="font-medium text-ink">{price}</span> : null}
        </p>
        <p className="mt-1 text-caption text-teal">
          {restaurant.scheduledDayDate ? t('scheduledOn', { date: restaurant.scheduledDayDate }) : t('notScheduled')}
        </p>
        {restaurant.notes ? <p className="mt-2 text-body text-ink">{restaurant.notes}</p> : null}

        <button
          type="button" disabled={busy}
          onClick={() => run(() => updateRestaurantAction(restaurant.id, { status: nextStatus }))}
          className="mt-4 w-full rounded-control bg-teal px-4 py-3 text-label font-medium text-white shadow-card disabled:opacity-40"
        >
          {restaurant.status === 'been' ? t('markWantToTry') : t('markBeen')}
        </button>

        {picking ? (
          <div className="mt-3">
            <p className="text-label font-medium text-ink">{t('dayPickerTitle')}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {days.map((d) => (
                <li key={d.date}>
                  <button
                    type="button" disabled={busy}
                    onClick={() => run(() => scheduleRestaurantToDayAction(restaurant.id, d.date))}
                    className="w-full rounded-control bg-paper px-3 py-2 text-left text-body text-ink shadow-inset disabled:opacity-40"
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
            className="mt-3 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
          >
            {t('scheduleToDay')}
          </button>
        )}

        {restaurant.scheduledDayDate ? (
          <button
            type="button" disabled={busy}
            onClick={() => run(() => unscheduleRestaurantAction(restaurant.id))}
            className="mt-3 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
          >
            {t('unschedule')}
          </button>
        ) : null}

        <button
          type="button" disabled={busy} onClick={() => onEdit(restaurant.id)}
          className="mt-3 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset disabled:opacity-40"
        >
          {t('editRestaurant')}
        </button>

        {confirmingDelete ? (
          <button
            type="button" disabled={busy}
            onClick={() => run(() => deleteRestaurantAction(restaurant.id))}
            className="mt-3 w-full rounded-control bg-red-600 px-4 py-3 text-label font-medium text-white shadow-card disabled:opacity-40"
          >
            {t('confirmDelete')}
          </button>
        ) : (
          <button
            type="button" disabled={busy} onClick={() => setConfirmingDelete(true)}
            className="mt-3 w-full rounded-control px-4 py-3 text-label font-medium text-red-600 disabled:opacity-40"
          >
            {t('delete')}
          </button>
        )}

        <button
          type="button" onClick={onClose}
          className="mt-4 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
