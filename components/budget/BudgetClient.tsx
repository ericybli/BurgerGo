'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { withBase } from '@/src/lib/basePath';
import { formatMoney } from '@/src/lib/currency';
import {
  buildCategoryBudgets,
  buildOverallBudget,
  groupByDate,
  BUDGET_CATEGORIES,
  type BudgetCategory,
} from '@/src/lib/budgetView';
import { EmptyState } from '@/components/EmptyState';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import { ExpenseSheet, type PlaceOption } from '@/components/budget/ExpenseSheet';
import { SetBudgetSheet } from '@/components/budget/SetBudgetSheet';
import type { ExpenseDTO, TargetDTO } from '@/app/api/trips/[tripId]/budget/route';

type GroupMode = 'day' | 'category';
type BudgetData = { expenses: ExpenseDTO[]; targets: TargetDTO[]; places: PlaceOption[] };
type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: BudgetData };

/** Today's calendar date (YYYY-MM-DD) — used as the default for new expenses. */
function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function BudgetClient({
  tripId,
  currency,
  locale = 'en',
}: {
  tripId: string;
  currency: string;
  locale?: string;
}) {
  const t = useTranslations('budget');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [online, setOnline] = useState(true);
  const [groupMode, setGroupMode] = useState<GroupMode>('day');
  const [expenseSheet, setExpenseSheet] = useState<{ open: boolean; expense?: ExpenseDTO }>({ open: false });
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, [tripId]);

  const load = useCallback(async () => {
    try {
      const [placesRes, budgetRes] = await Promise.all([
        fetch(withBase(`/api/trips/${tripId}/places`), { credentials: 'same-origin' }),
        fetch(withBase(`/api/trips/${tripId}/budget`), { credentials: 'same-origin' }),
      ]);
      if (!placesRes.ok || !budgetRes.ok) throw new Error('load failed');
      const { places } = (await placesRes.json()) as { places: { id: string; name: string }[] };
      const { expenses, targets } = (await budgetRes.json()) as {
        expenses: ExpenseDTO[];
        targets: TargetDTO[];
      };
      if (mountedRef.current) {
        setState({
          status: 'loaded',
          data: { expenses, targets, places: places.map((p) => ({ id: p.id, name: p.name })) },
        });
      }
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-ink-muted">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('summaryTitle')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { expenses, targets, places } = state.data;
  const overall = buildOverallBudget(expenses, targets);
  const categoryRows = buildCategoryBudgets(expenses, targets);

  function ExpenseRow({ e }: { e: ExpenseDTO }) {
    return (
      <button
        type="button"
        disabled={!online}
        onClick={() => setExpenseSheet({ open: true, expense: e })}
        className="flex w-full items-center justify-between rounded-card bg-card px-4 py-3 text-left shadow-card disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate text-body text-ink">
            {e.note ?? t(`categories.${e.category as BudgetCategory}`)}
          </span>
          {e.placeName ? (
            <span className="mt-0.5 inline-block rounded-chip bg-paper px-2 py-0.5 text-caption text-ink-muted">
              {e.placeName}
            </span>
          ) : null}
        </span>
        <span className="ml-3 shrink-0 text-label font-medium text-ink [font-variant-numeric:tabular-nums]">
          {formatMoney(e.amount, currency, locale)}
        </span>
      </button>
    );
  }

  const byDayGroups = groupByDate(expenses);
  const byCategoryGroups = BUDGET_CATEGORIES.map((c) => ({
    category: c,
    items: expenses.filter((e) => e.category === c),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-24 pt-2">
      <BudgetSummary
        overall={overall}
        categories={categoryRows}
        currency={currency}
        locale={locale}
        onSetBudget={() => setBudgetSheetOpen(true)}
      />

      <div className="mt-4 flex items-center justify-between">
        <div role="group" className="flex rounded-control bg-card p-0.5 shadow-inset">
          <button
            type="button"
            aria-pressed={groupMode === 'category'}
            onClick={() => setGroupMode('category')}
            className={`rounded-control px-3 py-1.5 text-caption font-medium ${groupMode === 'category' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('byCategory')}
          </button>
          <button
            type="button"
            aria-pressed={groupMode === 'day'}
            onClick={() => setGroupMode('day')}
            className={`rounded-control px-3 py-1.5 text-caption font-medium ${groupMode === 'day' ? 'bg-coral text-white' : 'text-ink-muted'}`}
          >
            {t('byDay')}
          </button>
        </div>
        <button
          type="button"
          disabled={!online}
          onClick={() => setExpenseSheet({ open: true })}
          className="rounded-control bg-coral px-4 py-2 text-caption font-medium text-white shadow-card active:bg-coral-press disabled:opacity-40"
        >
          {t('addExpense')}
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="mt-4">
          <EmptyState mascotAlt={t('summaryTitle')} headline={t('emptyHeadline')} subtext={t('emptySubtext')} />
        </div>
      ) : groupMode === 'day' ? (
        <div className="mt-4 flex flex-col gap-4">
          {byDayGroups.map((g) => (
            <section key={g.date}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-label font-semibold text-ink">{g.date}</h3>
                <span className="text-caption text-ink-muted [font-variant-numeric:tabular-nums]">
                  {formatMoney(g.total, currency, locale)}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <ExpenseRow e={e} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {byCategoryGroups.map((g) => (
            <section key={g.category}>
              <h3 className="mb-2 text-label font-semibold text-ink">{t(`categories.${g.category}`)}</h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <ExpenseRow e={e} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ExpenseSheet
        key={expenseSheet.expense?.id ?? 'new'}
        open={expenseSheet.open}
        tripId={tripId}
        expense={expenseSheet.expense}
        places={places}
        currency={currency}
        locale={locale}
        disabled={!online}
        today={todayISO()}
        onClose={() => setExpenseSheet({ open: false })}
        onSaved={() => {
          setExpenseSheet({ open: false });
          void load();
        }}
      />

      <SetBudgetSheet
        key={budgetSheetOpen ? 'open' : 'closed'}
        open={budgetSheetOpen}
        tripId={tripId}
        targets={targets}
        currency={currency}
        locale={locale}
        disabled={!online}
        onClose={() => setBudgetSheetOpen(false)}
        onSaved={() => {
          setBudgetSheetOpen(false);
          void load();
        }}
      />
    </main>
  );
}
