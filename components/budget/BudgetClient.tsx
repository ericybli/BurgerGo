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
import { SwipeRow } from '@/components/SwipeRow';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import { ExpenseSheet, type PlaceOption } from '@/components/budget/ExpenseSheet';
import { SetBudgetSheet } from '@/components/budget/SetBudgetSheet';
import { deleteExpenseAction } from '@/app/_actions/expenses';
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
  currency: currencyProp,
  locale = 'en',
}: {
  tripId: string;
  currency: string;
  locale?: string;
}) {
  const t = useTranslations('budget');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // The page seeds the env default; the /budget response carries the user's
  // current Settings currency (G18), which we adopt once loaded.
  const [currency, setCurrency] = useState(currencyProp);
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
      // The budget route returns slim place options too, so one fetch covers it.
      const budgetRes = await fetch(withBase(`/api/trips/${tripId}/budget`), { credentials: 'same-origin' });
      if (!budgetRes.ok) throw new Error('load failed');
      const { expenses, targets, places, currency: cur } = (await budgetRes.json()) as {
        expenses: ExpenseDTO[];
        targets: TargetDTO[];
        places: PlaceOption[];
        currency?: string;
      };
      if (mountedRef.current) {
        if (cur) setCurrency(cur);
        setState({ status: 'loaded', data: { expenses, targets, places } });
      }
    } catch {
      if (mountedRef.current) setState({ status: 'error' });
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Online-only delete + refresh. Reachable via swipe and the edit sheet's Delete. */
  function deleteExpense(id: string) {
    if (!online) return;
    void (async () => {
      try {
        await deleteExpenseAction(id);
      } finally {
        void load();
      }
    })();
  }

  if (state.status === 'loading') {
    return <p className="px-4 py-8 text-center text-body text-sub">{t('loading')}</p>;
  }
  if (state.status === 'error') {
    return <EmptyState mascotAlt={t('summaryTitle')} headline={t('errorHeadline')} subtext={t('errorSubtext')} />;
  }

  const { expenses, targets, places } = state.data;
  const overall = buildOverallBudget(expenses, targets);
  const categoryRows = buildCategoryBudgets(expenses, targets);

  function ExpenseRow({ e }: { e: ExpenseDTO }) {
    return (
      <SwipeRow
        disabled={!online}
        actions={[
          { label: t('edit'), onClick: () => setExpenseSheet({ open: true, expense: e }) },
          { label: t('delete'), danger: true, onClick: () => deleteExpense(e.id) },
        ]}
      >
        <button
          type="button"
          disabled={!online}
          onClick={() => setExpenseSheet({ open: true, expense: e })}
          className="flex w-full items-center justify-between border-b border-line bg-bg px-1 py-3 text-left transition active:opacity-70 disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink">
              {e.note ?? t(`categories.${e.category as BudgetCategory}`)}
            </span>
            {e.placeName ? (
              <span className="mt-0.5 inline-block rounded-chip bg-surface px-2 py-0.5 text-caption text-sub">
                {e.placeName}
              </span>
            ) : null}
          </span>
          <span className="ml-3 shrink-0 text-[14px] font-bold text-ink [font-variant-numeric:tabular-nums]">
            {formatMoney(e.amount, currency, locale)}
          </span>
        </button>
      </SwipeRow>
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
        <div role="group" className="flex rounded-[10px] bg-surface p-[3px] gap-0.5">
          <button
            type="button"
            aria-pressed={groupMode === 'category'}
            onClick={() => setGroupMode('category')}
            className={`rounded-lg px-3 py-1.5 text-center text-label whitespace-nowrap transition ${groupMode === 'category' ? 'bg-bg text-ink shadow-thumb' : 'text-sub'}`}
          >
            {t('byCategory')}
          </button>
          <button
            type="button"
            aria-pressed={groupMode === 'day'}
            onClick={() => setGroupMode('day')}
            className={`rounded-lg px-3 py-1.5 text-center text-label whitespace-nowrap transition ${groupMode === 'day' ? 'bg-bg text-ink shadow-thumb' : 'text-sub'}`}
          >
            {t('byDay')}
          </button>
        </div>
        <button
          type="button"
          disabled={!online}
          onClick={() => setExpenseSheet({ open: true })}
          className="inline-flex items-center justify-center rounded-[10px] bg-orange px-3.5 py-[9px] text-label text-white transition hover:bg-orange-press active:bg-orange-press disabled:bg-surface disabled:text-faint"
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
          {byDayGroups.map((g, i) => (
            <section
              key={g.date}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-micro uppercase text-faint [font-variant-numeric:tabular-nums]">{g.date}</h3>
                <span className="text-caption text-sub [font-variant-numeric:tabular-nums]">
                  {formatMoney(g.total, currency, locale)}
                </span>
              </div>
              <ul className="flex flex-col">
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
          {byCategoryGroups.map((g, i) => (
            <section
              key={g.category}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <h3 className="mb-1 text-micro uppercase text-faint">{t(`categories.${g.category}`)}</h3>
              <ul className="flex flex-col">
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
        key={`expense:${expenseSheet.open ? (expenseSheet.expense?.id ?? 'new') : 'closed'}`}
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
        key={`budget:${budgetSheetOpen ? 'open' : 'closed'}`}
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
