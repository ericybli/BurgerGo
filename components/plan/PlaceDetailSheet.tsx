'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/src/lib/useFocusTrap';
import type { PlaceDTO } from '@/src/lib/planView';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { updatePlaceAction, generatePlaceSummaryAction } from '@/app/_actions/places';
import { addExpenseAction } from '@/app/_actions/expenses';
import { minorToInput, inputToMinor } from '@/src/lib/currency';
import { placeCategoryToBudget } from '@/src/lib/budgetView';
import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';
import { PhotoGallery } from '@/components/plan/PhotoGallery';
import { usePhotoUpload } from '@/components/plan/usePhotoUpload';
import { deletePhotoAction } from '@/app/_actions/photos';
import { PlaceLinks } from '@/components/plan/PlaceLinks';

const CATEGORIES: PlaceDTO['category'][] = [
  'sightseeing', 'lodging', 'hotel', 'airbnb', 'airport', 'transport',
  'activity', 'shopping', 'parking', 'entrance', 'museum', 'event', 'other',
];

/** Today's calendar date (YYYY-MM-DD) — default `spentOn` for a saved place's expense. */
function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

type PlaceDetailSheetProps = {
  open: boolean;
  place: PlaceDTO;
  /** Trip display currency — formats the cost field + the "add as expense" amount. */
  currency: string;
  disabled: boolean;
  onClose: () => void;
  /**
   * Called after a successful save (or photo change). On a field save it passes
   * the place id + the edited fields so the parent can optimistically update its
   * local copy — this makes a just-saved note/edit show immediately on reopen,
   * without waiting for the async reload (which the photo path triggers too).
   */
  onSaved: (placeId?: string, patch?: Partial<PlaceDTO>) => void;
};

export function PlaceDetailSheet({
  open,
  place,
  currency,
  disabled,
  onClose,
  onSaved,
}: PlaceDetailSheetProps) {
  const t = useTranslations('plan');
  const tCat = useTranslations('placeCategory');
  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(place.address ?? '');
  const [category, setCategory] = useState<PlaceDTO['category']>(place.category);
  const [time, setTime] = useState(place.scheduledTime ?? '');
  const [notes, setNotes] = useState(place.notes ?? '');
  const [aiSummary, setAiSummary] = useState(place.aiSummary ?? '');
  const [regenerating, setRegenerating] = useState(false);
  // Cost as a major-unit string (e.g. "300.00"); empty = unset. Saved as integer
  // minor units. F3: this field was modeled but never surfaced until now.
  const [cost, setCost] = useState(place.cost != null ? minorToInput(place.cost, currency) : '');
  const [expenseStatus, setExpenseStatus] = useState<'idle' | 'added' | 'error'>('idle');
  // Coords + place id captured when the user re-pins via an address suggestion.
  // null → keep the place's existing coordinates on save.
  const [picked, setPicked] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(null);
  const { predictions, search, select, clear } = usePlacesAutocomplete();
  const [isPending, startTransition] = useTransition();
  // FIX I1: inline error when the Server Action rejects
  const [saveError, setSaveError] = useState<string | null>(null);
  const { upload, uploading } = usePhotoUpload();
  const [photoError, setPhotoError] = useState<string | null>(null);

  // M2: clear stale photo error whenever the sheet opens for a different place.
  useEffect(() => { setPhotoError(null); }, [place.id]);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  if (!open) return null;

  const mapsHref = placeUrl({
    name: place.name,
    lat: place.lat ?? 0,
    lng: place.lng ?? 0,
    googlePlaceId: place.googlePlaceId,
  });

  // FIX I3: Escape closes the dialog
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith('image/')) { setPhotoError(t('photoNotImage')); return; }
    const { photo, errorCode } = await upload({ file, tripId: place.tripId, ownerId: place.id });
    if (photo) {
      onSaved(); // PlanClient reloads → gallery + card thumb refresh
    } else {
      // Map server error codes to user-friendly i18n messages.
      if (errorCode === 'too_large') {
        setPhotoError(t('photoTooLarge'));
      } else if (errorCode === 'too_many') {
        setPhotoError(t('photoTooMany'));
      } else {
        setPhotoError(t('photoUploadFailed'));
      }
    }
  }

  function handlePhotoDelete(photoId: string) {
    setPhotoError(null);
    startTransition(async () => {
      try {
        await deletePhotoAction(photoId);
        onSaved();
      } catch {
        setPhotoError(t('photoUploadFailed'));
      }
    });
  }

  function handleAddressChange(value: string) {
    setAddress(value);
    setPicked(null); // typing invalidates a prior suggestion pick
    void search(value);
  }

  /** Re-pin: a picked suggestion carries the corrected coordinates + place id. */
  async function handlePick(placeId: string) {
    const filled = await select(placeId);
    if (!filled) return;
    if (filled.address) setAddress(filled.address);
    if (typeof filled.lat === 'number' && typeof filled.lng === 'number') {
      setPicked({ lat: filled.lat, lng: filled.lng, googlePlaceId: filled.googlePlaceId });
    }
    clear();
  }

  /** F3: log the entered cost as a budget expense linked back to this place. */
  function handleAddExpense() {
    const minor = inputToMinor(cost, currency);
    if (minor == null) return; // needs a positive cost
    setExpenseStatus('idle');
    startTransition(async () => {
      try {
        await addExpenseAction({
          tripId: place.tripId,
          amount: minor,
          category: placeCategoryToBudget(place.category),
          spentOn: place.dayDate ?? todayISO(),
          note: place.name,
          linkedPlaceId: place.id,
        });
        setExpenseStatus('added');
      } catch {
        setExpenseStatus('error');
      }
    });
  }

  // FIX I1: wrap action in try/catch; on error show message and keep sheet open
  function handleSave() {
    setSaveError(null);
    const patch = {
      name: name.trim(),
      address: address.trim() || null,
      category,
      scheduledTime: time || null,
      cost: cost.trim() === '' ? null : inputToMinor(cost, currency),
      notes: notes.trim() || null,
      aiSummary: aiSummary.trim() || null,
      // Only move the pin when the user re-picked an address suggestion.
      ...(picked ? { lat: picked.lat, lng: picked.lng, googlePlaceId: picked.googlePlaceId } : {}),
    };
    startTransition(async () => {
      try {
        await updatePlaceAction(place.id, patch);
        onSaved(place.id, patch);
        onClose();
      } catch {
        setSaveError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={place.name}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-4 font-serif text-title text-ink">{place.name}</h2>

        {/* FIX I1: inline save error */}
        {saveError ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {saveError}
          </p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="pd-name">{t('nameLabel')}</label>
        <input
          id="pd-name" type="text" value={name} disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-address">{t('addressLabel')}</label>
        <input
          id="pd-address" type="text" value={address} disabled={disabled}
          autoComplete="off"
          placeholder={t('addressSearchPlaceholder')}
          onChange={(e) => handleAddressChange(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />
        <p className="mt-1 text-caption text-ink-muted">{t('addressRepinHint')}</p>
        {predictions.length > 0 ? (
          <ul className="mt-2 flex flex-col overflow-hidden rounded-control border border-line bg-paper">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  disabled={disabled || isPending}
                  onClick={() => void handlePick(p.placeId)}
                  className="w-full px-3 py-2 text-left text-body text-ink transition hover:bg-coral-tint active:bg-coral-tint disabled:opacity-40"
                >
                  {p.description}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-category">{t('categoryLabel')}</label>
        <select
          id="pd-category" value={category} disabled={disabled}
          onChange={(e) => setCategory(e.target.value as PlaceDTO['category'])}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{tCat(c)}</option>
          ))}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-time">{t('timeLabel')}</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="pd-time" type="time" value={time} disabled={disabled}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
          />
          {time ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTime('')}
              className="shrink-0 rounded-control border border-line px-3 py-2 text-caption font-medium text-ink-muted transition hover:bg-line active:bg-line active:scale-[0.98] disabled:opacity-40"
            >
              {t('clear')}
            </button>
          ) : null}
        </div>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-cost">{t('costLabel')}</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-caption font-medium text-ink-muted">{currency}</span>
          <input
            id="pd-cost" type="text" inputMode="decimal" value={cost} disabled={disabled}
            placeholder="0"
            onChange={(e) => { setCost(e.target.value); setExpenseStatus('idle'); }}
            className="flex-1 rounded-control border border-line bg-paper px-3 py-2 text-body text-ink [font-variant-numeric:tabular-nums] transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          disabled={disabled || isPending || inputToMinor(cost, currency) == null || expenseStatus === 'added'}
          onClick={handleAddExpense}
          className="mt-2 w-full rounded-control border border-line px-4 py-2 text-caption font-medium text-teal transition hover:bg-teal-tint active:bg-teal-tint active:scale-[0.98] disabled:opacity-40"
        >
          {expenseStatus === 'added' ? t('addedToBudget') : t('addAsExpense')}
        </button>
        {expenseStatus === 'error' ? (
          <p role="alert" className="mt-1 text-caption text-red-600">{t('saveFailed')}</p>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <label className="block text-label font-medium text-ink" htmlFor="pd-ai">{t('aiSummary')}</label>
          <button
            type="button"
            disabled={disabled || regenerating}
            onClick={async () => {
              setRegenerating(true);
              try {
                const r = await generatePlaceSummaryAction(place.id);
                if (r?.aiSummary) setAiSummary(r.aiSummary);
              } catch { /* leave field as-is */ }
              finally { setRegenerating(false); }
            }}
            className="rounded-chip px-2 py-1 text-caption font-medium text-teal transition hover:bg-teal-tint active:scale-95 disabled:opacity-40"
          >
            {regenerating ? t('regenerating') : t('regenerateSummary')}
          </button>
        </div>
        <textarea
          id="pd-ai" value={aiSummary} disabled={disabled}
          onChange={(e) => setAiSummary(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-notes">{t('notesLabel')}</label>
        <textarea
          id="pd-notes" value={notes} disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />

        {photoError ? (
          <p role="alert" className="mt-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {photoError}
          </p>
        ) : null}

        <PhotoGallery
          photos={place.photos}
          placeName={place.name}
          disabled={disabled}
          onDelete={handlePhotoDelete}
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-photo">
          {t('addPhoto')}
        </label>
        {disabled ? <p className="text-caption text-ink-muted">{t('addPhotoOffline')}</p> : null}
        {/* No `capture` attribute → the OS picker offers Photo Library *and*
            Camera (capture would force camera-only on iOS). */}
        <input
          id="pd-photo"
          type="file"
          accept="image/*"
          disabled={disabled || uploading}
          onChange={handlePhotoChange}
          className="mt-1 w-full text-body text-ink disabled:opacity-60"
        />
        {uploading ? (
          <p className="mt-1 text-caption text-ink-muted">{t('uploadingPhoto')}</p>
        ) : null}

        <PlaceLinks
          tripId={place.tripId}
          placeId={place.id}
          links={place.links}
          disabled={disabled}
          onChanged={onSaved}
        />

        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block w-full rounded-control bg-teal px-4 py-3 text-center text-label font-medium text-white shadow-card transition hover:shadow-lift active:scale-[0.98]"
        >
          {t('openInGoogleMaps')}
        </a>

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset transition hover:bg-line active:bg-line active:scale-[0.98]"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={handleSave}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card transition hover:bg-coral-press hover:shadow-lift active:scale-[0.98] active:bg-coral-press disabled:opacity-40"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
