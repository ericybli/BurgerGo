'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { addPlaceAction } from '@/app/_actions/places';
import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';
import { reverseGeocode } from '@/components/plan/googleClient';

type SubTab = 'search' | 'drop';
type Dropped = { lat: number; lng: number; address: string | null };

type AddPlaceSheetProps = {
  open: boolean;
  tripId: string;
  /** Target bucket: a day date for Days, or null for the Saved bucket. */
  dayDate: string | null;
  disabled: boolean;
  onClose: () => void;
  onAdded: () => void;
};

export function AddPlaceSheet({
  open,
  tripId,
  dayDate,
  disabled,
  onClose,
  onAdded,
}: AddPlaceSheetProps) {
  const t = useTranslations('plan');
  const [tab, setTab] = useState<SubTab>('search');
  const [query, setQuery] = useState('');
  const [dropped, setDropped] = useState<Dropped | null>(null);
  const [dropName, setDropName] = useState('');
  const [isPending, startTransition] = useTransition();
  // FIX I1: inline error when the Server Action rejects
  const [saveError, setSaveError] = useState<string | null>(null);
  const { predictions, search, select } = usePlacesAutocomplete();

  if (!open) return null;

  // FIX I3: Escape closes the dialog
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    void search(value);
  }

  // FIX I1: wrap action in try/catch; on error show message and keep sheet open
  function commit(payload: Parameters<typeof addPlaceAction>[0]) {
    setSaveError(null);
    startTransition(async () => {
      try {
        await addPlaceAction(payload);
        onAdded();
        onClose();
      } catch {
        setSaveError(t('saveFailed'));
      }
    });
  }

  async function handlePrediction(placeId: string) {
    const filled = await select(placeId);
    if (!filled) return;
    commit({
      tripId,
      dayDate,
      name: filled.name ?? 'Place',
      address: filled.address,
      lat: filled.lat,
      lng: filled.lng,
      category: (filled.categoryGuess as PlaceDTO['category']) ?? 'other',
      googlePlaceId: filled.googlePlaceId,
    });
  }

  async function handleDrop(lat: number, lng: number) {
    const address = await reverseGeocode(lat, lng);
    setDropped({ lat, lng, address });
  }

  function confirmDrop() {
    if (!dropped) return;
    commit({
      tripId,
      dayDate,
      name: dropName.trim() || (dropped.address ?? 'Dropped pin'),
      address: dropped.address,
      lat: dropped.lat,
      lng: dropped.lng,
      category: 'other',
      googlePlaceId: null,
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
        {/* FIX I1: inline save error */}
        {saveError ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {saveError}
          </p>
        ) : null}

        {/* FIX M5: tabpanel role on each content wrapper */}
        <div role="tablist" aria-label={t('addPlace')} className="mb-4 flex rounded-control bg-paper p-0.5 shadow-inset">
          <button
            id="add-tab-search"
            type="button"
            role="tab"
            aria-selected={tab === 'search'}
            aria-controls="add-panel-search"
            onClick={() => setTab('search')}
            className={`flex-1 rounded-control py-1.5 text-label font-medium ${
              tab === 'search' ? 'bg-coral text-white' : 'text-ink-muted'
            }`}
          >
            {t('searchSubTab')}
          </button>
          <button
            id="add-tab-drop"
            type="button"
            role="tab"
            aria-selected={tab === 'drop'}
            aria-controls="add-panel-drop"
            onClick={() => setTab('drop')}
            className={`flex-1 rounded-control py-1.5 text-label font-medium ${
              tab === 'drop' ? 'bg-coral text-white' : 'text-ink-muted'
            }`}
          >
            {t('dropPinTab')}
          </button>
        </div>

        {tab === 'search' ? (
          // FIX M5: role="tabpanel" + aria-labelledby
          <div id="add-panel-search" role="tabpanel" aria-labelledby="add-tab-search">
            <input
              type="text"
              value={query}
              disabled={disabled}
              placeholder={t('searchPlaceholder')}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
            />
            <ul className="mt-2 flex flex-col">
              {predictions.map((p) => (
                <li key={p.placeId}>
                  <button
                    type="button"
                    disabled={disabled || isPending}
                    onClick={() => void handlePrediction(p.placeId)}
                    className="w-full rounded-control px-2 py-2 text-left text-body text-ink hover:bg-paper disabled:opacity-40"
                  >
                    {p.description}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          // FIX M5: role="tabpanel" + aria-labelledby
          <div id="add-panel-drop" role="tabpanel" aria-labelledby="add-tab-drop">
            <p className="mb-2 text-caption text-ink-muted">{t('longPressHint')}</p>
            {/* B3's mini Google map mounts here; the drop callback is the contract.
                The test affordance simulates a long-press drop. */}
            <button
              type="button"
              data-testid="map-drop-target"
              disabled={disabled}
              onClick={() => void handleDrop(35.71, 139.79)}
              className="flex h-48 w-full items-center justify-center rounded-card bg-paper text-caption text-ink-muted shadow-inset disabled:opacity-40"
            >
              {t('longPressHint')}
            </button>
            {dropped ? (
              <div className="mt-3">
                <label className="block text-label font-medium text-ink" htmlFor="drop-name">
                  {t('nameLabel')}
                </label>
                <input
                  id="drop-name"
                  type="text"
                  value={dropName}
                  onChange={(e) => setDropName(e.target.value)}
                  className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink"
                />
                <p className="mt-1 text-caption text-ink-muted">{dropped.address}</p>
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={confirmDrop}
                  className="mt-3 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
                >
                  {t('confirm')}
                </button>
              </div>
            ) : null}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
