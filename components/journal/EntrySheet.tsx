'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  addEntryAction,
  updateEntryAction,
  deleteEntryAction,
} from '@/app/_actions/journal';
import { deletePhotoAction } from '@/app/_actions/photos';
import { usePhotoUpload } from '@/components/plan/usePhotoUpload';
import { PhotoGallery } from '@/components/plan/PhotoGallery';
import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

type Props = {
  open: boolean;
  tripId: string;
  /** Present → edit mode; absent → add mode. */
  entry?: EntryDTO;
  disabled: boolean; // offline → true
  today: string; // YYYY-MM-DD default for add mode
  onClose: () => void;
  /** Called after any successful mutation (save/delete/photo) so the owner reloads. */
  onSaved: () => void;
};

/** One markdown toolbar action: wrap the selection (or insert at the caret). */
type MdAction = { id: 'bold' | 'italic' | 'heading' | 'list' | 'link'; before: string; after: string };
const MD_ACTIONS: MdAction[] = [
  { id: 'bold', before: '**', after: '**' },
  { id: 'italic', before: '*', after: '*' },
  { id: 'heading', before: '# ', after: '' },
  { id: 'list', before: '- ', after: '' },
  { id: 'link', before: '[', after: '](https://)' },
];

export function EntrySheet({
  open,
  tripId,
  entry,
  disabled,
  today,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('journal');
  const isEdit = !!entry;
  const [title, setTitle] = useState(entry?.title ?? '');
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? today);
  const [body, setBody] = useState(entry?.body ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Used only to read selection range and restore caret after toolbar action.
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const { upload, uploading } = usePhotoUpload();

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  /** Wrap the current textarea selection in the action's markdown syntax. */
  function applyMarkdown(action: MdAction) {
    const ta = bodyRef.current;
    const start = ta?.selectionStart ?? body.length;
    const end = ta?.selectionEnd ?? body.length;
    const selected = body.slice(start, end);
    const next = body.slice(0, start) + action.before + selected + action.after + body.slice(end);
    setBody(next);
    // Restore a sensible caret/selection after React flushes the state update.
    const caretStart = start + action.before.length;
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(caretStart, caretStart + selected.length);
      }
    });
  }

  function handleSave() {
    setError(null);
    const trimmed = title.trim();
    if (trimmed === '') {
      setError(t('titleRequired'));
      return;
    }
    const payload = {
      title: trimmed,
      body,
      entryDate: entryDate === '' ? null : entryDate,
    };
    startTransition(async () => {
      try {
        if (isEdit && entry) {
          await updateEntryAction(entry.id, payload);
        } else {
          await addEntryAction({ tripId, ...payload });
        }
        onSaved();
        onClose();
      } catch {
        setError(t('saveFailed'));
      }
    });
  }

  function handleDeleteClick() {
    setConfirmingDelete(true);
  }

  function handleConfirmDelete() {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteEntryAction(entry.id);
        onSaved();
        onClose();
      } catch {
        setError(t('mutationFailed'));
      }
    });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !entry) return;
    setPhotoError(null);
    if (!file.type.startsWith('image/')) { setPhotoError(t('photoNotImage')); return; }
    const { photo, errorCode } = await upload({ file, tripId, ownerId: entry.id });
    if (photo) {
      onSaved(); // owner reloads → gallery refreshes with the new photo
    } else if (errorCode === 'too_large') {
      setPhotoError(t('photoTooLarge'));
    } else if (errorCode === 'too_many') {
      setPhotoError(t('photoTooMany'));
    } else {
      setPhotoError(t('photoUploadFailed'));
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editEntry') : t('newEntry')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="mb-3 text-heading font-semibold text-ink">
          {isEdit ? t('editEntry') : t('newEntry')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="je-title">
          {t('titleLabel')}
        </label>
        <input
          id="je-title"
          type="text"
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="je-date">
          {t('dateLabel')}
        </label>
        <input
          id="je-date"
          type="date"
          value={entryDate}
          disabled={disabled}
          onChange={(e) => setEntryDate(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="je-body">
          {t('bodyLabel')}
        </label>
        <div role="toolbar" aria-label={t('mdToolbar')} className="mt-1 flex flex-wrap gap-1">
          {MD_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={() => applyMarkdown(a)}
              className="rounded-control bg-paper px-3 py-1.5 text-caption font-medium text-ink shadow-inset disabled:opacity-40"
            >
              {t(`md${a.id.charAt(0).toUpperCase()}${a.id.slice(1)}` as `md${'Bold' | 'Italic' | 'Heading' | 'List' | 'Link'}`)}
            </button>
          ))}
        </div>
        <textarea
          id="je-body"
          ref={bodyRef}
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 font-mono text-body text-ink disabled:opacity-60"
        />

        {photoError ? (
          <p role="alert" className="mt-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {photoError}
          </p>
        ) : null}

        {isEdit && entry ? (
          <>
            <PhotoGallery
              photos={entry.photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))}
              placeName={entry.title}
              disabled={disabled}
              onDelete={handlePhotoDelete}
            />
            <label className="mt-3 block text-label font-medium text-ink" htmlFor="je-photo">
              {t('addPhoto')}
            </label>
            {disabled ? <p className="text-caption text-ink-muted">{t('addPhotoOffline')}</p> : null}
            <input
              id="je-photo"
              type="file"
              accept="image/*"
              disabled={disabled || uploading}
              onChange={handlePhotoChange}
              className="mt-1 w-full text-body text-ink disabled:opacity-60"
            />
            {uploading ? (
              <p className="mt-1 text-caption text-ink-muted">{t('uploadingPhoto')}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-caption text-ink-muted">{t('photosAfterSaveHint')}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isPending}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('save')}
        </button>

        {isEdit ? (
          <>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={disabled || isPending}
                className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-red-600 shadow-inset disabled:opacity-40"
              >
                {t('delete')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={disabled || isPending}
                className="mt-2 w-full rounded-control bg-red-50 px-4 py-3 text-label font-medium text-red-700 shadow-inset disabled:opacity-40"
              >
                {t('confirmDelete')}
              </button>
            )}
          </>
        ) : null}

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
