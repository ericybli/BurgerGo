'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { renameTripAction } from '@/app/_actions/trips';

type RenameSheetProps = {
  open: boolean;
  tripId: string;
  currentName: string;
  onClose: () => void;
};

export function RenameSheet({ open, tripId, currentName, onClose }: RenameSheetProps) {
  const t = useTranslations('renameSheet');
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError(t('nameRequired'));
      return;
    }
    startTransition(async () => {
      try {
        await renameTripAction(tripId, trimmed);
        onClose();
      } catch {
        setError(t('saveError'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full rounded-t-sheet bg-card p-6 shadow-lift animate-fade-up"
      >
        <div className="mx-auto -mt-2 mb-3 h-1 w-9 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="font-serif text-title text-ink">{t('title')}</h2>

        <label className="mt-4 block text-label font-medium text-ink" htmlFor="rename-name">
          {t('nameLabel')}
        </label>
        <input
          id="rename-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink transition focus:border-coral focus:outline-none focus:shadow-[0_0_0_3px_var(--coral-tint)]"
        />

        {error ? (
          <p role="alert" className="mt-3 text-caption font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-control bg-paper px-4 py-3 text-label font-medium text-ink shadow-inset transition hover:bg-line active:bg-line active:scale-[0.98]"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card transition hover:bg-coral-press hover:shadow-lift active:bg-coral-press active:scale-[0.98] disabled:opacity-50"
          >
            {t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
