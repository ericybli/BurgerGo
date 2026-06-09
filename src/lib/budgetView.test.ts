import { describe, it, expect } from 'vitest';
import {
  BUDGET_CATEGORIES,
  type ExpenseLite,
  type TargetLite,
  spentByCategory,
  totalSpent,
  targetMap,
  buildCategoryBudgets,
  buildOverallBudget,
  groupByDate,
  clampPercent,
  placeCategoryToBudget,
} from '@/src/lib/budgetView';

const expenses: ExpenseLite[] = [
  { id: 'e1', amount: 1000, category: 'food', spentOn: '2026-06-06', note: 'Ramen', linkedPlaceId: null },
  { id: 'e2', amount: 500, category: 'food', spentOn: '2026-06-05', note: null, linkedPlaceId: 'p1' },
  { id: 'e3', amount: 2000, category: 'lodging', spentOn: '2026-06-05', note: null, linkedPlaceId: null },
  { id: 'e4', amount: 300, category: 'transport', spentOn: '2026-06-06', note: null, linkedPlaceId: null },
];

const targets: TargetLite[] = [
  { category: null, plannedAmount: 10000 },
  { category: 'food', plannedAmount: 2000 },
  { category: 'lodging', plannedAmount: 1500 },
];

describe('budgetView', () => {
  it('exposes the six categories in stable order', () => {
    expect(BUDGET_CATEGORIES).toEqual([
      'food', 'lodging', 'transport', 'activities', 'shopping', 'other',
    ]);
  });

  it('sums spent per category, zero for untouched categories', () => {
    const s = spentByCategory(expenses);
    expect(s.food).toBe(1500);
    expect(s.lodging).toBe(2000);
    expect(s.transport).toBe(300);
    expect(s.activities).toBe(0);
    expect(s.shopping).toBe(0);
    expect(s.other).toBe(0);
  });

  it('totals all spending', () => {
    expect(totalSpent(expenses)).toBe(3800);
  });

  it('maps targets, with null = overall', () => {
    const m = targetMap(targets);
    expect(m.overall).toBe(10000);
    expect(m.food).toBe(2000);
    expect(m.lodging).toBe(1500);
    expect(m.transport).toBeNull();
  });

  it('builds per-category rows: spent, planned, remaining, over flag, percent', () => {
    const rows = buildCategoryBudgets(expenses, targets);
    const food = rows.find((r) => r.category === 'food')!;
    expect(food.spent).toBe(1500);
    expect(food.planned).toBe(2000);
    expect(food.remaining).toBe(500);
    expect(food.over).toBe(false);
    expect(food.percent).toBe(75);

    const lodging = rows.find((r) => r.category === 'lodging')!;
    expect(lodging.spent).toBe(2000);
    expect(lodging.planned).toBe(1500);
    expect(lodging.remaining).toBe(-500); // over budget
    expect(lodging.over).toBe(true);

    const transport = rows.find((r) => r.category === 'transport')!;
    expect(transport.planned).toBeNull(); // no target set
    expect(transport.remaining).toBeNull();
    expect(transport.over).toBe(false);
    expect(transport.percent).toBeNull();
  });

  it('builds the overall roll-up vs the overall target', () => {
    const o = buildOverallBudget(expenses, targets);
    expect(o.spent).toBe(3800);
    expect(o.planned).toBe(10000);
    expect(o.remaining).toBe(6200);
    expect(o.over).toBe(false);
    expect(o.percent).toBe(38);
  });

  it('overall with no target leaves planned/remaining/percent null', () => {
    const o = buildOverallBudget(expenses, []);
    expect(o.spent).toBe(3800);
    expect(o.planned).toBeNull();
    expect(o.remaining).toBeNull();
    expect(o.percent).toBeNull();
  });

  it('groups expenses by spent_on date, newest date first', () => {
    const groups = groupByDate(expenses);
    expect(groups.map((g) => g.date)).toEqual(['2026-06-06', '2026-06-05']);
    expect(groups[0]!.total).toBe(1300); // e1 1000 + e4 300
    expect(groups[1]!.items.map((i) => i.id)).toEqual(['e2', 'e3']);
  });

  it('clampPercent floors at 0 and caps display at 100 even when over', () => {
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(null)).toBe(0);
  });

  it('placeCategoryToBudget maps place categories to the six budget buckets', () => {
    expect(placeCategoryToBudget('hotel')).toBe('lodging');
    expect(placeCategoryToBudget('airbnb')).toBe('lodging');
    expect(placeCategoryToBudget('airport')).toBe('transport');
    expect(placeCategoryToBudget('parking')).toBe('transport');
    expect(placeCategoryToBudget('shopping')).toBe('shopping');
    expect(placeCategoryToBudget('sightseeing')).toBe('activities');
    expect(placeCategoryToBudget('museum')).toBe('activities');
    expect(placeCategoryToBudget('entrance')).toBe('activities');
    expect(placeCategoryToBudget('other')).toBe('other');
  });
});
