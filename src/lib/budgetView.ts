/**
 * Pure planned-vs-actual budget math (Plan 2 §4.2). Operates on plain DTOs so
 * the BudgetClient and tests share one source of truth. Money is integer minor
 * units throughout; rendering to a localized string is the caller's job
 * (currency.formatMoney). `percent` is an integer 0..n (can exceed 100 when
 * over budget); use clampPercent for progress-bar widths.
 */

export const BUDGET_CATEGORIES = [
  'food',
  'lodging',
  'transport',
  'activities',
  'shopping',
  'other',
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export interface ExpenseLite {
  id: string;
  amount: number;
  category: BudgetCategory;
  spentOn: string; // YYYY-MM-DD
  note: string | null;
  linkedPlaceId: string | null;
}

export interface TargetLite {
  category: BudgetCategory | null; // null = overall
  plannedAmount: number;
}

export type SpentMap = Record<BudgetCategory, number>;

/** Spent per category; every category present (0 when untouched). */
export function spentByCategory(expenses: ExpenseLite[]): SpentMap {
  const map = Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c, 0])) as SpentMap;
  for (const e of expenses) map[e.category] += e.amount;
  return map;
}

/** Grand total of all spending. */
export function totalSpent(expenses: ExpenseLite[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export interface TargetLookup {
  overall: number | null;
  food: number | null;
  lodging: number | null;
  transport: number | null;
  activities: number | null;
  shopping: number | null;
  other: number | null;
}

/** Look up planned amounts; null category → overall; missing → null. */
export function targetMap(targets: TargetLite[]): TargetLookup {
  const base: TargetLookup = {
    overall: null,
    food: null,
    lodging: null,
    transport: null,
    activities: null,
    shopping: null,
    other: null,
  };
  for (const t of targets) {
    const key = t.category ?? 'overall';
    base[key] = t.plannedAmount;
  }
  return base;
}

export interface BudgetRow {
  /** A category, or 'overall' for the roll-up. */
  category: BudgetCategory | 'overall';
  spent: number;
  planned: number | null;
  remaining: number | null; // planned - spent; negative = over
  over: boolean; // planned != null && spent > planned
  percent: number | null; // round(spent/planned*100); null when no target
}

function buildRow(
  category: BudgetCategory | 'overall',
  spent: number,
  planned: number | null,
): BudgetRow {
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

/** One row per category (stable order) with planned-vs-actual derivations. */
export function buildCategoryBudgets(
  expenses: ExpenseLite[],
  targets: TargetLite[],
): BudgetRow[] {
  const spent = spentByCategory(expenses);
  const tm = targetMap(targets);
  return BUDGET_CATEGORIES.map((c) => buildRow(c, spent[c], tm[c]));
}

/** The whole-trip roll-up vs the overall target. */
export function buildOverallBudget(
  expenses: ExpenseLite[],
  targets: TargetLite[],
): BudgetRow {
  return buildRow('overall', totalSpent(expenses), targetMap(targets).overall);
}

export interface DateGroup {
  date: string; // YYYY-MM-DD
  total: number;
  items: ExpenseLite[];
}

/**
 * Group expenses by spent_on, newest date first. Items inside a date keep the
 * incoming order (the read handler returns spent_on desc, created_at desc).
 */
export function groupByDate(expenses: ExpenseLite[]): DateGroup[] {
  const byDate = new Map<string, ExpenseLite[]>();
  for (const e of expenses) {
    const list = byDate.get(e.spentOn);
    if (list) list.push(e);
    else byDate.set(e.spentOn, [e]);
  }
  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([date, items]) => ({
      date,
      total: items.reduce((s, i) => s + i.amount, 0),
      items,
    }));
}

/** Progress-bar width: clamp a percent to 0..100, null → 0. */
export function clampPercent(percent: number | null): number {
  if (percent === null) return 0;
  return Math.max(0, Math.min(100, percent));
}
