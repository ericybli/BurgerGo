'use client';

import { useState, useTransition, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/src/lib/useFocusTrap';
import { addPhotoListAction, renamePhotoListAction } from '@/app/_actions/photoLists';

type PhotoListSheetProps = {
  open: boolean;
  tripId: string;
  /** Present → rename mode; absent → create mode. */
  list?: { id: string; name: string };
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Create or rename a Photography list. Mounted with a fresh `key` on every open
 * (JournalClient) so the name field never carries over stale text.
 */
export function PhotoListSheet({ open, tripId, list, disabled, onClose, onSaved }: PhotoListSheetProps) {
  const t = useTranslations('journal');
  const [name, setName] = useState(list?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  if (!open) return null;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('listNameRequired'));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (list) await renamePhotoListAction(tripId, list.id, trimmed);
        else await addPhotoListAction(tripId, trimmed);
        onSaved();
        onClose();
      } catch {
        setError(t('mutationFailed'));
      }
    });
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={list ? t('renameList') : t('newPhotoList')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-9 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 font-serif text-title text-ink">{list ? t('renameList') : t('newPhotoList')}</h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="pl-name">{t('listNameLabel')}</label>
        <input
          id="pl-name"
          type="text"
          value={name}
          disabled={disabled}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder={t('listNamePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)] disabled:opacity-60"
        />

        <button
          type="button"
          disabled={disabled || isPending}
          onClick={handleSave}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card transition hover:bg-coral-press hover:shadow-lift active:scale-[0.98] active:bg-coral-press disabled:opacity-40"
        >
          {list ? t('save') : t('createList')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset transition hover:bg-line active:bg-line active:scale-[0.98]"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
