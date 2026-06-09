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
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet animate-fade-up"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{t('title')}</h2>

        <label className="mt-4 block text-label text-ink" htmlFor="rename-name">
          {t('nameLabel')}
        </label>
        <input
          id="rename-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
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
            className="flex-1 rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98] disabled:bg-surface disabled:text-faint"
          >
            {t('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
