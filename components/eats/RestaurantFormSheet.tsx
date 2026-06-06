'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { addRestaurantAction, updateRestaurantAction } from '@/app/_actions/restaurants';

type RestaurantStatus = RestaurantDTO['status'];

type RestaurantFormSheetProps = {
  open: boolean;
  tripId: string;
  /** null = add mode; a restaurant = edit mode. */
  restaurant: RestaurantDTO | null;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const RATINGS = ['1', '2', '3', '4', '5'];
const PRICES = ['1', '2', '3', '4'];

export function RestaurantFormSheet({
  open,
  tripId,
  restaurant,
  disabled,
  onClose,
  onSaved,
}: RestaurantFormSheetProps) {
  const t = useTranslations('eats');
  const isEdit = restaurant !== null;
  const [name, setName] = useState(restaurant?.name ?? '');
  const [cuisine, setCuisine] = useState(restaurant?.cuisine ?? '');
  const [status, setStatus] = useState<RestaurantStatus>(restaurant?.status ?? 'want-to-try');
  const [rating, setRating] = useState(restaurant?.rating != null ? String(restaurant.rating) : '');
  const [price, setPrice] = useState(restaurant?.priceLevel != null ? String(restaurant.priceLevel) : '');
  const [notes, setNotes] = useState(restaurant?.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed === '') return; // client guard; server re-validates
    const payload = {
      name: trimmed,
      cuisine: cuisine.trim() || null,
      status,
      rating: rating === '' ? null : Number(rating),
      priceLevel: price === '' ? null : Number(price),
      notes: notes.trim() || null,
    };
    setSaveError(null);
    startTransition(async () => {
      try {
        if (isEdit && restaurant) {
          await updateRestaurantAction(restaurant.id, payload);
        } else {
          await addRestaurantAction({ tripId, ...payload });
        }
        onSaved();
        onClose();
      } catch {
        setSaveError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editRestaurant') : t('addRestaurant')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        {saveError ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {saveError}
          </p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="rf-name">{t('nameLabel')}</label>
        <input
          id="rf-name" type="text" value={name} disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-cuisine">{t('cuisineLabel')}</label>
        <input
          id="rf-cuisine" type="text" value={cuisine} disabled={disabled}
          onChange={(e) => setCuisine(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-status">{t('statusLabel')}</label>
        <select
          id="rf-status" value={status} disabled={disabled}
          onChange={(e) => setStatus(e.target.value as RestaurantStatus)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="want-to-try">{t('statusWantToTry')}</option>
          <option value="been">{t('statusBeen')}</option>
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-rating">{t('ratingLabel')}</label>
        <select
          id="rf-rating" value={rating} disabled={disabled}
          onChange={(e) => setRating(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="">{t('ratingClear')}</option>
          {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-price">{t('priceLabel')}</label>
        <select
          id="rf-price" value={price} disabled={disabled}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="">{t('priceClear')}</option>
          {PRICES.map((p) => <option key={p} value={p}>{'$'.repeat(Number(p))}</option>)}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="rf-notes">{t('notesLabel')}</label>
        <textarea
          id="rf-notes" value={notes} disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <div className="mt-4 flex gap-3">
          <button
            type="button" onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
          >
            {t('cancel')}
          </button>
          <button
            type="button" disabled={disabled || isPending} onClick={handleSave}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
