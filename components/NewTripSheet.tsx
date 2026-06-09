'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createTripAction } from '@/app/_actions/trips';

type NewTripSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Fired after a successful create (before close) so the owner can refresh its list. */
  onCreated?: () => void;
};

export function NewTripSheet({ open, onClose, onCreated }: NewTripSheetProps) {
  const t = useTranslations('newTripSheet');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) {
      setError(t('nameRequired'));
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError(t('endBeforeStart'));
      return;
    }
    startTransition(async () => {
      try {
        await createTripAction({ name: name.trim(), startDate, endDate });
        onCreated?.();
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
        noValidate
        className="w-full rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet animate-fade-up"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{t('title')}</h2>

        <label className="mt-4 block text-label text-ink" htmlFor="trip-name">
          {t('nameLabel')}
        </label>
        <input
          id="trip-name"
          type="text"
          value={name}
          placeholder={t('namePlaceholder')}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
        />

        <label className="mt-4 block text-label text-ink" htmlFor="trip-start">
          {t('startLabel')}
        </label>
        <input
          id="trip-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)]"
        />

        <label className="mt-4 block text-label text-ink" htmlFor="trip-end">
          {t('endLabel')}
        </label>
        <input
          id="trip-end"
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
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
            className="flex-1 rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98] disabled:opacity-50"
          >
            {t('create')}
          </button>
        </div>
      </form>
    </div>
  );
}
