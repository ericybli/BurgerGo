'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { inputToMinor, minorToInput } from '@/src/lib/currency';
import { BUDGET_CATEGORIES, type BudgetCategory } from '@/src/lib/budgetView';
import { setTargetAction, clearTargetAction } from '@/app/_actions/budgetTargets';
import type { TargetDTO } from '@/app/api/trips/[tripId]/budget/route';

type Props = {
  open: boolean;
  tripId: string;
  targets: TargetDTO[];
  currency: string;
  locale: string;
  disabled: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type Key = 'overall' | BudgetCategory;

export function SetBudgetSheet({
  open,
  tripId,
  targets,
  currency,
  locale,
  disabled,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('budget');
  void locale;

  // Current planned minor-unit amount keyed by 'overall' | category.
  const current = new Map<Key, number>();
  for (const tgt of targets) {
    current.set((tgt.category ?? 'overall') as Key, tgt.plannedAmount);
  }

  const initial = (key: Key): string => {
    const v = current.get(key);
    return v === undefined ? '' : minorToInput(v, currency);
  };

  const [values, setValues] = useState<Record<Key, string>>(() => {
    const base = { overall: initial('overall') } as Record<Key, string>;
    for (const c of BUDGET_CATEGORIES) base[c] = initial(c);
    return base;
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function setValue(key: Key, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function handleSave() {
    setError(null);
    const keys: Key[] = ['overall', ...BUDGET_CATEGORIES];
    startTransition(async () => {
      try {
        for (const key of keys) {
          const category = key === 'overall' ? null : (key as BudgetCategory);
          const next = inputToMinor(values[key], currency);
          const prev = current.get(key) ?? null;
          if (next === prev) continue; // unchanged (incl. both null/empty)
          if (next === null) {
            await clearTargetAction(tripId, category);
          } else {
            await setTargetAction({ tripId, category, plannedAmount: next });
          }
        }
        onSaved();
        onClose();
      } catch {
        setError(t('saveFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('setBudget')}
      className="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] backdrop-blur-[3px]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-bg p-[18px] pb-8 shadow-sheet"
      >
        <div className="mx-auto mb-3.5 h-1 w-10 rounded-chip bg-line" aria-hidden="true" />
        <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em] text-ink">{t('setBudget')}</h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control border border-line bg-bg px-3 py-2 text-caption font-medium text-danger">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-sub">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label text-ink" htmlFor="tgt-overall">
          {t('overallPlannedLabel')}
        </label>
        <input
          id="tgt-overall"
          type="text"
          inputMode="decimal"
          value={values.overall}
          disabled={disabled}
          onChange={(e) => setValue('overall', e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition [font-variant-numeric:tabular-nums] focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <ul className="mt-3 flex flex-col gap-3">
          {BUDGET_CATEGORIES.map((c) => {
            const label = t('categoryPlannedLabel', { category: t(`categories.${c}`) });
            return (
              <li key={c}>
                <label className="block text-label text-ink" htmlFor={`tgt-${c}`}>
                  {label}
                </label>
                <input
                  id={`tgt-${c}`}
                  aria-label={label}
                  type="text"
                  inputMode="decimal"
                  value={values[c]}
                  disabled={disabled}
                  onChange={(e) => setValue(c, e.target.value)}
                  className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition [font-variant-numeric:tabular-nums] focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
                />
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isPending}
          className="mt-5 inline-flex w-full items-center justify-center rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press disabled:opacity-40"
        >
          {t('save')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-control border border-line bg-bg px-4 py-3 text-label text-ink transition hover:bg-surface active:opacity-70"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
