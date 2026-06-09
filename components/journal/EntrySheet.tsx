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
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em] text-ink">
          {isEdit ? t('editEntry') : t('newEntry')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-sub">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-micro uppercase text-faint" htmlFor="je-title">
          {t('titleLabel')}
        </label>
        <input
          id="je-title"
          type="text"
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-micro uppercase text-faint" htmlFor="je-date">
          {t('dateLabel')}
        </label>
        <input
          id="je-date"
          type="date"
          value={entryDate}
          disabled={disabled}
          onChange={(e) => setEntryDate(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] tabular-nums text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-micro uppercase text-faint" htmlFor="je-body">
          {t('bodyLabel')}
        </label>
        <div role="toolbar" aria-label={t('mdToolbar')} className="mt-1 flex flex-wrap gap-1">
          {MD_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={() => applyMarkdown(a)}
              className="rounded-lg bg-surface px-[11px] py-[5px] text-[12px] font-semibold text-sub hover:bg-line active:scale-95 disabled:opacity-40"
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
          className="mt-1 w-full rounded-[10px] border border-line bg-bg px-3 py-2.5 text-[14px] leading-[24px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        {photoError ? (
          <p role="alert" className="mt-3 rounded-control bg-danger/10 px-3 py-2 text-caption text-danger">
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
            <label className="mt-3 block text-micro uppercase text-faint" htmlFor="je-photo">
              {t('addPhoto')}
            </label>
            {disabled ? <p className="text-caption text-faint">{t('addPhotoOffline')}</p> : null}
            <input
              id="je-photo"
              type="file"
              accept="image/*"
              disabled={disabled || uploading}
              onChange={handlePhotoChange}
              className="mt-1 w-full text-[13px] text-sub disabled:opacity-60"
            />
            {uploading ? (
              <p className="mt-1 text-caption text-faint">{t('uploadingPhoto')}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-caption text-faint">{t('photosAfterSaveHint')}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || isPending}
            className="flex-1 rounded-[12px] bg-orange py-3 text-[14px] font-semibold text-white hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-[90px] rounded-[12px] border border-line bg-bg py-3 text-[14px] font-semibold text-ink hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
        </div>

        {isEdit ? (
          <>
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={disabled || isPending}
                className="mt-3 w-full rounded-control px-4 py-2.5 text-label text-danger active:opacity-70 disabled:opacity-40"
              >
                {t('delete')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={disabled || isPending}
                className="mt-3 w-full rounded-control bg-danger px-4 py-2.5 text-label text-white active:opacity-80 disabled:opacity-40"
              >
                {t('confirmDelete')}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
