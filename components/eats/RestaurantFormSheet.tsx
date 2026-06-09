'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { addRestaurantAction, updateRestaurantAction } from '@/app/_actions/restaurants';
import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';
import { forwardGeocode } from '@/components/plan/googleClient';

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
  const initialAddress = restaurant?.address ?? '';
  const [name, setName] = useState(restaurant?.name ?? '');
  const [cuisine, setCuisine] = useState(restaurant?.cuisine ?? '');
  const [address, setAddress] = useState(initialAddress);
  const [status, setStatus] = useState<RestaurantStatus>(restaurant?.status ?? 'want-to-try');
  const [rating, setRating] = useState(restaurant?.rating != null ? String(restaurant.rating) : '');
  const [price, setPrice] = useState(restaurant?.priceLevel != null ? String(restaurant.priceLevel) : '');
  const [notes, setNotes] = useState(restaurant?.notes ?? '');
  /** Coordinates + place id captured when a Google suggestion is picked. */
  const [picked, setPicked] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const { predictions, search, select, clear } = usePlacesAutocomplete();

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function handleAddressChange(value: string) {
    setAddress(value);
    setPicked(null); // editing the text invalidates any prior suggestion pick
    void search(value);
  }

  async function handlePick(placeId: string) {
    const filled = await select(placeId);
    if (!filled) return;
    if (!name.trim() && filled.name) setName(filled.name);
    if (filled.address) setAddress(filled.address);
    if (typeof filled.lat === 'number' && typeof filled.lng === 'number') {
      setPicked({ lat: filled.lat, lng: filled.lng, googlePlaceId: filled.googlePlaceId });
    }
    clear(); // hide the suggestion list once one is chosen
  }

  function handleSave() {
    const trimmed = name.trim();
    if (trimmed === '') return; // client guard; server re-validates
    const trimmedAddress = address.trim();
    setSaveError(null);
    startTransition(async () => {
      try {
        // Resolve coordinates: a picked suggestion already carries them; an
        // empty address clears any prior location; a changed free-text address
        // is best-effort forward-geocoded. An unchanged address keeps the
        // existing coords so editing other fields never drops the pin.
        let lat: number | null = picked?.lat ?? restaurant?.lat ?? null;
        let lng: number | null = picked?.lng ?? restaurant?.lng ?? null;
        let gpid: string | null = picked?.googlePlaceId ?? restaurant?.googlePlaceId ?? null;
        if (!trimmedAddress) {
          lat = null;
          lng = null;
          gpid = null;
        } else if (!picked && trimmedAddress !== initialAddress) {
          const geo = await forwardGeocode(trimmedAddress);
          lat = geo ? geo.lat : null;
          lng = geo ? geo.lng : null;
          gpid = geo?.googlePlaceId ?? null;
          // When the address resolves to a Google place, pull Details so its
          // photo is downloaded + cached (auto-fills the restaurant photo).
          if (gpid) {
            const details = await select(gpid);
            gpid = details?.googlePlaceId || gpid;
          }
        }
        const payload = {
          name: trimmed,
          cuisine: cuisine.trim() || null,
          status,
          rating: rating === '' ? null : Number(rating),
          priceLevel: price === '' ? null : Number(price),
          notes: notes.trim() || null,
          address: trimmedAddress || null,
          lat,
          lng,
          googlePlaceId: gpid,
        };
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

        {saveError ? (
          <p role="alert" className="mb-3 rounded-control border border-line px-3 py-2 text-caption text-danger">
            {saveError}
          </p>
        ) : null}

        <label className="block text-label text-ink" htmlFor="rf-name">{t('nameLabel')}</label>
        <input
          id="rf-name" type="text" value={name} disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label text-ink" htmlFor="rf-cuisine">{t('cuisineLabel')}</label>
        <input
          id="rf-cuisine" type="text" value={cuisine} disabled={disabled}
          onChange={(e) => setCuisine(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label text-ink" htmlFor="rf-address">{t('addressLabel')}</label>
        <input
          id="rf-address" type="text" value={address} disabled={disabled}
          placeholder={t('addressSearchPlaceholder')}
          autoComplete="off"
          onChange={(e) => handleAddressChange(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />
        <p className="mt-1 text-caption text-sub">{t('addressSearchHint')}</p>

        {predictions.length > 0 ? (
          <ul className="mt-2 flex flex-col overflow-hidden rounded-control border border-line bg-bg">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={() => void handlePick(p.placeId)}
                  className="w-full px-3 py-2 text-left text-body text-ink transition hover:bg-accent-tint active:opacity-70 disabled:opacity-40"
                >
                  {p.description}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="mt-3 block text-label text-ink" htmlFor="rf-status">{t('statusLabel')}</label>
        <select
          id="rf-status" value={status} disabled={disabled}
          onChange={(e) => setStatus(e.target.value as RestaurantStatus)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        >
          <option value="want-to-try">{t('statusWantToTry')}</option>
          <option value="been">{t('statusBeen')}</option>
        </select>

        <label className="mt-3 block text-label text-ink" htmlFor="rf-rating">{t('ratingLabel')}</label>
        <select
          id="rf-rating" value={rating} disabled={disabled}
          onChange={(e) => setRating(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        >
          <option value="">{t('ratingClear')}</option>
          {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <label className="mt-3 block text-label text-ink" htmlFor="rf-price">{t('priceLabel')}</label>
        <select
          id="rf-price" value={price} disabled={disabled}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        >
          <option value="">{t('priceClear')}</option>
          {PRICES.map((p) => <option key={p} value={p}>{'$'.repeat(Number(p))}</option>)}
        </select>

        <label className="mt-3 block text-label text-ink" htmlFor="rf-notes">{t('notesLabel')}</label>
        <textarea
          id="rf-notes" value={notes} disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <div className="mt-4 flex gap-3">
          <button
            type="button" onClick={onClose}
            className="flex-1 rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
          <button
            type="button" disabled={disabled || isPending} onClick={handleSave}
            className="flex-1 inline-flex items-center justify-center rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press disabled:opacity-40"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
