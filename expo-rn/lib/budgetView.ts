/** Pure budget math, ported from the web `src/lib/budgetView.ts`. */
import type { BudgetCategory, Expense, BudgetTarget } from './api';

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  'food', 'lodging', 'transport', 'activities', 'shopping', 'other',
];

export const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  food: 'Food', lodging: 'Lodging', transport: 'Transport',
  activities: 'Activities', shopping: 'Shopping', other: 'Other',
};

export type BudgetRow = {
  category: BudgetCategory | 'overall';
  spent: number;
  planned: number | null;
  remaining: number | null;
  over: boolean;
  percent: number | null;
};

export function totalSpent(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

export function spentByCategory(expenses: Expense[]): Record<BudgetCategory, number> {
  const out = {
    food: 0, lodging: 0, transport: 0, activities: 0, shopping: 0, other: 0,
  } as Record<BudgetCategory, number>;
  for (const e of expenses) out[e.category] += e.amount;
  return out;
}

type TargetMap = Record<BudgetCategory | 'overall', number | null>;

export function targetMap(targets: BudgetTarget[]): TargetMap {
  const out: TargetMap = {
    overall: null, food: null, lodging: null, transport: null,
    activities: null, shopping: null, other: null,
  };
  for (const t of targets) out[t.category ?? 'overall'] = t.plannedAmount;
  return out;
}

function buildRow(category: BudgetCategory | 'overall', spent: number, planned: number | null): BudgetRow {
  if (planned === null || planned <= 0) {
    return {
      category,
      spent,
      planned,
      remaining: planned === null ? null : planned - spent,
      over: planned !== null && spent > planned,
      percent: null,
    };
  }
  return {
    category,
    spent,
    planned,
    remaining: planned - spent,
    over: spent > planned,
    percent: Math.round((spent / planned) * 100),
  };
}

export function buildCategoryBudgets(expenses: Expense[], targets: BudgetTarget[]): BudgetRow[] {
  const spent = spentByCategory(expenses);
  const tm = targetMap(targets);
  return BUDGET_CATEGORIES.map((c) => buildRow(c, spent[c], tm[c]));
}

export function buildOverallBudget(expenses: Expense[], targets: BudgetTarget[]): BudgetRow {
  return buildRow('overall', totalSpent(expenses), targetMap(targets).overall);
}

/** Progress-bar width 0..100; null → 0. */
export function clampPercent(percent: number | null): number {
  if (percent === null) return 0;
  return Math.max(0, Math.min(100, percent));
}

export type DateGroup = { date: string; total: number; items: Expense[] };

/** Group expenses by date, newest date first; items keep incoming order. */
export function groupByDate(expenses: Expense[]): DateGroup[] {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    const list = map.get(e.spentOn) ?? [];
    list.push(e);
    map.set(e.spentOn, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, items]) => ({ date, total: items.reduce((s, e) => s + e.amount, 0), items }));
}
