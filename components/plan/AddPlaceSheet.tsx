'use client';

import { useState, useTransition, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/src/lib/useFocusTrap';
import type { PlaceDTO } from '@/src/lib/planView';
import { addPlaceAction, generatePlaceSummaryAction } from '@/app/_actions/places';
import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';
import { forwardGeocode } from '@/components/plan/googleClient';

const CATEGORIES: PlaceDTO['category'][] = [
  'sightseeing',
  'lodging',
  'hotel',
  'airbnb',
  'airport',
  'transport',
  'activity',
  'shopping',
  'parking',
  'entrance',
  'museum',
  'event',
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

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function handleAddressChange(value: string) {
    setAddress(value);
    setPicked(null); // editing the text invalidates any prior suggestion pick
    void search(value);
  }

  /** Clear the whole address field in one tap (the × inside the input). */
  function handleAddressClear() {
    setAddress('');
    setPicked(null);
    clear();
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
    const trimmedAddress = address.trim() || null;
    // Require a name OR an address — a typed address can resolve to a Google
    // place whose name we auto-fill below.
    if (!trimmedName && !trimmedAddress) {
      setError(t('nameRequired'));
      return;
    }
    startTransition(async () => {
      try {
        let lat: number | null = picked?.lat ?? null;
        let lng: number | null = picked?.lng ?? null;
        let googlePlaceId: string | null = picked?.googlePlaceId ?? null;
        let resolvedName = trimmedName;
        // No coordinates from a suggestion but we have a typed address →
        // best-effort forward-geocode so the place maps + routes. When the match
        // carries a place id, pull Details (downloads + caches the photo) and
        // auto-fill the name when the user didn't supply one.
        if (lat === null && trimmedAddress) {
          const geo = await forwardGeocode(trimmedAddress);
          if (geo) {
            lat = geo.lat;
            lng = geo.lng;
            if (geo.googlePlaceId) {
              const details = await select(geo.googlePlaceId);
              googlePlaceId = details?.googlePlaceId || geo.googlePlaceId;
              if (!resolvedName && details?.name) resolvedName = details.name;
            }
          }
        }
        // Fall back to the typed address as a name when none could be derived.
        if (!resolvedName) resolvedName = trimmedAddress ?? '';
        if (!resolvedName) {
          setError(t('nameRequired'));
          return;
        }
        const created = await addPlaceAction({
          tripId,
          dayDate,
          name: resolvedName,
          address: trimmedAddress,
          lat,
          lng,
          category,
          googlePlaceId,
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
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('addPlace')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em] text-ink">{t('addPlace')}</h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-orange-tint px-3 py-2 text-caption text-danger">
            {error}
          </p>
        ) : null}

        <label className="block text-label text-ink" htmlFor="add-name">
          {t('nameLabel')}
        </label>
        <input
          id="add-name"
          type="text"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label text-ink" htmlFor="add-address">
          {t('addressLabel')}
        </label>
        <div className="relative mt-1">
          <input
            id="add-address"
            type="text"
            value={address}
            disabled={disabled}
            placeholder={t('addressSearchPlaceholder')}
            autoComplete="off"
            onChange={(e) => handleAddressChange(e.target.value)}
            className="w-full rounded-control border border-line bg-bg px-3 py-2.5 pr-10 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
          />
          {address && !disabled ? (
            <button
              type="button"
              aria-label={t('clearAddress')}
              onClick={handleAddressClear}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-chip text-faint transition hover:bg-surface hover:text-ink active:scale-90"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-caption text-sub">{t('addressSearchHint')}</p>

        {predictions.length > 0 ? (
          <ul className="mt-2 flex flex-col overflow-hidden rounded-control border border-line bg-bg">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={() => void handlePick(p.placeId)}
                  className="w-full px-3 py-2 text-left text-body text-ink transition hover:bg-surface active:bg-surface disabled:opacity-40"
                >
                  {p.description}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="mt-3 block text-label text-ink" htmlFor="add-category">
          {t('categoryLabel')}
        </label>
        <select
          id="add-category"
          value={category}
          disabled={disabled}
          onChange={(e) => setCategory(e.target.value as PlaceDTO['category'])}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
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
          className="mt-5 w-full rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98] disabled:bg-surface disabled:text-faint"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
