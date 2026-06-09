'use client';

import { useState, useTransition, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useFocusTrap } from '@/src/lib/useFocusTrap';
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

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

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
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('editExpense') : t('addExpense')}
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
          {isEdit ? t('editExpense') : t('addExpense')}
        </h2>

        {error ? (
          <p role="alert" className="mb-3 rounded-control border border-line bg-bg px-3 py-2 text-caption font-medium text-danger">
            {error}
          </p>
        ) : null}

        {disabled ? (
          <p className="mb-3 text-caption text-sub">{t('offlineHint')}</p>
        ) : null}

        <label className="block text-label text-ink" htmlFor="exp-amount">
          {t('amountLabel')}
        </label>
        <input
          id="exp-amount"
          type="text"
          inputMode="decimal"
          value={amount}
          disabled={disabled}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition [font-variant-numeric:tabular-nums] focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label text-ink" htmlFor="exp-category">
          {t('categoryLabel')}
        </label>
        <select
          id="exp-category"
          value={category}
          disabled={disabled}
          onChange={(e) => setCategory(e.target.value as BudgetCategory)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        >
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-label text-ink" htmlFor="exp-date">
          {t('dateLabel')}
        </label>
        <input
          id="exp-date"
          type="date"
          value={spentOn}
          disabled={disabled}
          onChange={(e) => setSpentOn(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label text-ink" htmlFor="exp-note">
          {t('noteLabel')}
        </label>
        <input
          id="exp-note"
          type="text"
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
        />

        <label className="mt-3 block text-label text-ink" htmlFor="exp-place">
          {t('linkPlaceLabel')}
        </label>
        <select
          id="exp-place"
          value={linkedPlaceId}
          disabled={disabled}
          onChange={(e) => setLinkedPlaceId(e.target.value)}
          className="mt-1 w-full rounded-control border border-line bg-bg px-3 py-2.5 text-[14px] text-ink placeholder:text-faint transition focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60"
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
          className="mt-5 inline-flex w-full items-center justify-center rounded-[12px] bg-orange px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
        >
          {t('save')}
        </button>

        {isEdit ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={disabled || isPending}
            className="mt-2 w-full rounded-control px-4 py-3 text-label text-danger transition active:opacity-70 disabled:opacity-40"
          >
            {t('delete')}
          </button>
        ) : null}

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
