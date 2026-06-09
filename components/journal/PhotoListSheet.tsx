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
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em] text-ink">{list ? t('renameList') : t('newPhotoList')}</h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-danger/10 px-3 py-2 text-caption text-danger">
            {error}
          </p>
        ) : null}

        <label className="block text-micro uppercase text-faint" htmlFor="pl-name">{t('listNameLabel')}</label>
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
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={disabled || isPending}
            onClick={handleSave}
            className="flex-1 rounded-[12px] bg-orange py-3 text-[14px] font-semibold text-white hover:bg-orange-press active:bg-orange-press disabled:opacity-40"
          >
            {list ? t('save') : t('createList')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-[90px] rounded-[12px] border border-line bg-bg py-3 text-[14px] font-semibold text-ink hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
