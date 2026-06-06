'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { inputToMinor, minorToInput } from '@/src/lib/currency';
import { BUDGET_CATEGORIES, type BudgetCategory } from '@/src/lib/budgetView';
import {
  addExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from '@/app/_actions/expenses';
import type { ExpenseDTO } from '@/app/api/trips/[tripId]/budget/route';

export type PlaceOption = { id: string; name: string };

type Props = {
  open: boolean;
  tripId: string;
  /** Present → edit mode; absent → add mode. */
  expense?: ExpenseDTO;
  places: PlaceOption[];
  currency: string;
  locale: string;
  disabled: boolean; // offline → true
  today: string; // YYYY-MM-DD default for add mode
  onClose: () => void;
  onSaved: () => void;
};

export function ExpenseSheet({
  open,
  tripId,
  expense,
  places,
  currency,
  locale,
  disabled,
  today,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('budget');
  const isEdit = !!expense;
  const [amount, setAmount] = useState(expense ? minorToInput(expense.amount, currency) : '');
  const [category, setCategory] = useState<BudgetCategory>(
    (expense?.category as BudgetCategory) ?? 'food',
  );
  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? today);
  const [note, setNote] = useState(expense?.note ?? '');
  const [linkedPlaceId, setLinkedPlaceId] = useState(expense?.linkedPlaceId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // `locale` is part of the props contract for symmetry with the rest of the
  // budget UI; the amount input renders in fixed minor-unit precision so no
  // locale-specific parsing is applied here.
  void locale;

  if (!open) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') onClose();
  }

  function handleSave() {
    setError(null);
    const minor = inputToMinor(amount, currency);
    if (minor === null) {
      setError(t('invalidAmount'));
      return;
    }
    const payload = {
      category,
      spentOn,
      note: note.trim() === '' ? null : note.trim(),
      linkedPlaceId: linkedPlaceId === '' ? null : linkedPlaceId,
    };
    startTransition(async () => {
      try {
        if (isEdit && expense) {
          await updateExpenseAction(expense.id, { amount: minor, ...payload });
        } else {
          await addExpenseAction({ tripId, amount: minor, ...payload });
        }
        onSaved();
        onClose();
      } catch {
        setError(t('saveFailed'));
      }
    });
  }

  function handleDelete() {
    if (!expense) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteExpenseAction(expense.id);
        onSaved();
        onClose();
      } catch {
        setError(t('mutationFailed'));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editExpense') : t('addExpense')}
      className="fixed inset-0 z-50 flex items-end bg-[rgb(110_85_68_/_0.45)]"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-sheet bg-card p-6 shadow-lift"
      >
        <h2 className="mb-3 text-heading font-semibold text-ink">
          {isEdit ? t('editExpense') : t('addExpense')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control bg-red-50 px-3 py-2 text-caption text-red-700">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-ink-muted">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label font-medium text-ink" htmlFor="exp-amount">
          {t('amountLabel')}
        </label>
        <input
          id="exp-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          disabled={disabled}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink [font-variant-numeric:tabular-nums] disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-category">
          {t('categoryLabel')}
        </label>
        <select
          id="exp-category"
          value={category}
          disabled={disabled}
          onChange={(e) => setCategory(e.target.value as BudgetCategory)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-date">
          {t('dateLabel')}
        </label>
        <input
          id="exp-date"
          type="date"
          value={spentOn}
          disabled={disabled}
          onChange={(e) => setSpentOn(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-note">
          {t('noteLabel')}
        </label>
        <input
          id="exp-note"
          type="text"
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        />

        <label className="mt-3 block text-label font-medium text-ink" htmlFor="exp-place">
          {t('linkPlaceLabel')}
        </label>
        <select
          id="exp-place"
          value={linkedPlaceId}
          disabled={disabled}
          onChange={(e) => setLinkedPlaceId(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-paper px-3 py-2 text-body text-ink disabled:opacity-60"
        >
          <option value="">{t('noLinkedPlace')}</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isPending}
          className="mt-5 w-full rounded-control bg-coral px-4 py-3 text-label font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('save')}
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={disabled || isPending}
            className="mt-2 w-full rounded-control bg-paper px-4 py-3 text-label font-medium text-red-600 shadow-inset disabled:opacity-40"
          >
            {t('delete')}
          </button>
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
