'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { PlaceDTO } from '@/src/lib/planView';
import { placeUrl } from '@/src/lib/googleMapsUrl';
import { updatePlaceAction, generatePlaceSummaryAction } from '@/app/_actions/places';
import { PhotoGallery } from '@/components/plan/PhotoGallery';
import { usePhotoUpload } from '@/components/plan/usePhotoUpload';
import { deletePhotoAction } from '@/app/_actions/photos';
import { PlaceLinks } from '@/components/plan/PlaceLinks';

const CATEGORIES: PlaceDTO['category'][] = [
  'sightseeing', 'lodging', 'transport', 'activity', 'other',
];

type PlaceDetailSheetProps = {
  open: boolean;
  place: PlaceDTO;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function PlaceDetailSheet({
  open,
  place,
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
  const [isPending, startTransition] = useTransition();
  // FIX I1: inline error when the Server Action rejects
  const [saveError, setSaveError] = useState<string | null>(null);
  const { upload, uploading } = usePhotoUpload();
  const [photoError, setPhotoError] = useState<string | null>(null);

  // M2: clear stale photo error whenever the sheet opens for a different place.
  useEffect(() => { setPhotoError(null); }, [place.id]);

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

  // FIX I1: wrap action in try/catch; on error show message and keep sheet open
  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      try {
        await updatePlaceAction(place.id, {
          name: name.trim(),
          address: address.trim() || null,
          category,
          scheduledTime: time || null,
          notes: notes.trim() || null,
          aiSummary: aiSummary.trim() || null,
        });
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
      aria-label={place.name}
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

        <label className="block text-label font-medium text-ink" htmlFor="pd-name">{t('nameLabel')}</label>
        <input
          id="pd-name" type="text" value={name} disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-address">{t('addressLabel')}</label>
        <input
          id="pd-address" type="text" value={address} disabled={disabled}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-category">{t('categoryLabel')}</label>
        <select
          id="pd-category" value={category} disabled={disabled}
          onChange={(e) => setCategory(e.target.value as PlaceDTO['category'])}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
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
            className="flex-1 rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
          />
          {time ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setTime('')}
              className="shrink-0 rounded-control border border-line px-3 py-2 text-caption font-medium text-ink-muted active:bg-line disabled:opacity-40"
            >
              {t('clear')}
            </button>
          ) : null}
        </div>

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
            className="text-caption font-medium text-teal disabled:opacity-40"
          >
            {regenerating ? t('regenerating') : t('regenerateSummary')}
          </button>
        </div>
        <textarea
          id="pd-ai" value={aiSummary} disabled={disabled}
          onChange={(e) => setAiSummary(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="pd-notes">{t('notesLabel')}</label>
        <textarea
          id="pd-notes" value={notes} disabled={disabled}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
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
          className="mt-4 block w-full rounded-control bg-teal px-4 py-3 text-center text-label font-medium text-white shadow-card"
        >
          {t('openInGoogleMaps')}
        </a>

        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={handleSave}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
