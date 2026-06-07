'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { addPlaceAction, generatePlaceSummaryAction } from '@/app/_actions/places';
import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';
import { forwardGeocode } from '@/components/plan/googleClient';

const CATEGORIES: PlaceDTO['category'][] = [
  'sightseeing',
  'lodging',
  'transport',
  'activity',
  'other',
];

type AddPlaceSheetProps = {
  open: boolean;
  tripId: string;
  /** Target bucket: a day date for Days, or null for the Saved bucket. */
  dayDate: string | null;
  disabled: boolean;
  onClose: () => void;
  onAdded: () => void;
};

/**
 * Add a place via one unified form: a Name, an Address field that surfaces
 * Google Places autocomplete suggestions as you type (pick one to auto-fill
 * name/address/coordinates, or ignore them and type a free-form address), and
 * a Category. On save, a picked suggestion already carries coordinates; a
 * hand-typed address is best-effort forward-geocoded so the place still maps
 * and routes. If geocoding is unavailable, the place is saved by name+address
 * with no coordinates (it lists fine, just without a map pin).
 */
export function AddPlaceSheet({
  open,
  tripId,
  dayDate,
  disabled,
  onClose,
  onAdded,
}: AddPlaceSheetProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<PlaceDTO['category']>('other');
  /** Coordinates + place id captured when a Google suggestion is picked. */
  const [picked, setPicked] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
    if (filled.categoryGuess) setCategory(filled.categoryGuess as PlaceDTO['category']);
    if (typeof filled.lat === 'number' && typeof filled.lng === 'number') {
      setPicked({ lat: filled.lat, lng: filled.lng, googlePlaceId: filled.googlePlaceId });
    }
    clear(); // hide the suggestion list once one is chosen
  }

  function handleSave() {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t('nameRequired'));
      return;
    }
    const trimmedAddress = address.trim() || null;
    startTransition(async () => {
      try {
        let lat: number | null = picked?.lat ?? null;
        let lng: number | null = picked?.lng ?? null;
        // No coordinates from a suggestion but we have a typed address →
        // best-effort forward-geocode so the place maps + routes.
        if (lat === null && trimmedAddress) {
          const geo = await forwardGeocode(trimmedAddress);
          if (geo) {
            lat = geo.lat;
            lng = geo.lng;
          }
        }
        const created = await addPlaceAction({
          tripId,
          dayDate,
          name: trimmedName,
          address: trimmedAddress,
          lat,
          lng,
          category,
          googlePlaceId: picked?.googlePlaceId ?? null,
        });
        // Fire-and-forget AI summary; reload picks it up when it lands. Never blocks the add.
        void generatePlaceSummaryAction(created.id).catch(() => {});
        onAdded();
        onClose();
      } catch {
        setError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('addPlace')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="mb-3 text-heading font-semibold text-ink">{t('addPlace')}</h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="add-name">
          {t('nameLabel')}
        </label>
        <input
          id="add-name"
          type="text"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="add-address">
          {t('addressLabel')}
        </label>
        <input
          id="add-address"
          type="text"
          value={address}
          disabled={disabled}
          placeholder={t('addressSearchPlaceholder')}
          autoComplete="off"
          onChange={(e) => handleAddressChange(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />
        <p className="mt-1 text-caption text-ink-muted">{t('addressSearchHint')}</p>

        {predictions.length > 0 ? (
          <ul className="mt-2 flex flex-col rounded-control border border-line bg-paper">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={() => void handlePick(p.placeId)}
                  className="w-full px-3 py-2 text-left text-body text-ink hover:bg-card disabled:opacity-40"
                >
                  {p.description}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="add-category">
          {t('categoryLabel')}
        </label>
        <select
          id="add-category"
          value={category}
          disabled={disabled}
          onChange={(e) => setCategory(e.target.value as PlaceDTO['category'])}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {tCat(c)}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={disabled || isPending}
          onClick={handleSave}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
