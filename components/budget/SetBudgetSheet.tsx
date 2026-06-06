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
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="mb-3 text-heading font-semibold text-ink">{t('setBudget')}</h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="tgt-overall">
          {t('overallPlannedLabel')}
        </label>
        <input
          id="tgt-overall"
          type="text"
          inputMode="decimal"
          value={values.overall}
          disabled={disabled}
          onChange={(e) => setValue('overall', e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink [font-variant-numeric:tabular-nums] disabled:opacity-60"
        />

        <ul className="mt-3 flex flex-col gap-3">
          {BUDGET_CATEGORIES.map((c) => {
            const label = t('categoryPlannedLabel', { category: t(`categories.${c}`) });
            return (
              <li key={c}>
                <label className="block text-label font-medium text-ink" htmlFor={`tgt-${c}`}>
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
                  className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink [font-variant-numeric:tabular-nums] disabled:opacity-60"
                />
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isPending}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('save')}
        </button>
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
