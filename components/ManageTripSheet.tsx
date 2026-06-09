'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { Trip } from '@/src/db/schema';
import { diffDays } from '@/src/lib/days';
import {
  renameTripAction,
  shiftTripDatesAction,
  addTripDayAction,
  removeTripDayAction,
} from '@/app/_actions/trips';

type ManageTripSheetProps = {
  trip: Trip;
  onClose: () => void;
  /** Fired after any successful change so the owner can refresh its list. */
  onChanged: () => void;
};

/**
 * Home-page "Manage trip" sheet: rename, move the whole date window (places
 * shift with it), and add/remove a day at the end. Each control applies its own
 * action and the sheet stays open so several edits can be made in a row.
 */
export function ManageTripSheet({ trip, onClose, onChanged }: ManageTripSheetProps) {
  const t = useTranslations('manageTripSheet');
  const [current, setCurrent] = useState<Trip>(trip);
  const [name, setName] = useState(trip.name);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const lengthDays = diffDays(current.startDate, current.endDate) + 1;

  function run(fn: () => Promise<Trip>, opts: { syncStart?: boolean } = {}) {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        const updated = await fn();
        setCurrent(updated);
        setName(updated.name);
        if (opts.syncStart) setStartDate(updated.startDate);
        setStatus(t('saved'));
        onChanged();
      } catch {
        setError(t('saveError'));
      }
    });
  }

  const inputCls = 'rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60';
  const tealBtn = 'shrink-0 rounded-control border border-line bg-bg px-3 py-2 text-label text-accent transition hover:bg-accent-tint active:opacity-70 disabled:opacity-40';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      tabIndex={-1}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet animate-fade-up"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">{t('title')}</h2>

        {error ? (
          <p role="alert" className="mt-3 text-caption font-medium text-danger">{error}</p>
        ) : null}
        {status && !error ? (
          <p className="mt-3 text-caption font-medium text-accent">{status}</p>
        ) : null}

        {/* Rename */}
        <label className="mt-4 block text-label text-ink" htmlFor="mt-name">{t('nameLabel')}</label>
        <div className="mt-1 flex gap-2">
          <input
            id="mt-name" type="text" value={name} disabled={isPending}
            onChange={(e) => setName(e.target.value)}
            className={`flex-1 ${inputCls}`}
          />
          <button
            type="button"
            disabled={isPending || name.trim() === '' || name.trim() === current.name}
            onClick={() => run(() => renameTripAction(current.id, name.trim()))}
            className={tealBtn}
          >
            {t('rename')}
          </button>
        </div>

        {/* Move the whole window */}
        <p className="mt-6 text-heading text-ink">{t('datesTitle')}</p>
        <label className="mt-2 block text-label text-ink" htmlFor="mt-start">{t('startLabel')}</label>
        <div className="mt-1 flex gap-2">
          <input
            id="mt-start" type="date" value={startDate} disabled={isPending}
            onChange={(e) => setStartDate(e.target.value)}
            className={`flex-1 ${inputCls}`}
          />
          <button
            type="button"
            disabled={isPending || startDate === '' || startDate === current.startDate}
            onClick={() => run(() => shiftTripDatesAction(current.id, startDate), { syncStart: true })}
            className={tealBtn}
          >
            {t('move')}
          </button>
        </div>
        <p className="mt-1 text-caption text-sub">{t('datesHint')}</p>

        {/* Length: add / remove a day at the end */}
        <p className="mt-6 text-heading text-ink">{t('lengthTitle')}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 text-body text-ink [font-variant-numeric:tabular-nums]">{t('lengthDays', { days: lengthDays })}</span>
          <button
            type="button"
            disabled={isPending || lengthDays <= 1}
            onClick={() => run(() => removeTripDayAction(current.id))}
            className={tealBtn}
          >
            {t('removeDay')}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => addTripDayAction(current.id))}
            className="shrink-0 rounded-control bg-orange px-3 py-2 text-label text-white transition hover:bg-orange-press active:bg-orange-press active:scale-[0.98] disabled:opacity-40"
          >
            {t('addDay')}
          </button>
        </div>
        <p className="mt-1 text-caption text-sub">{t('removeDayHint')}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-[12px] border border-line bg-bg px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface active:opacity-70"
        >
          {t('close')}
        </button>
      </div>
    </div>
  );
}
