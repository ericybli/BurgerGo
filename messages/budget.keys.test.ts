import { describe, it, expect } from 'vitest';
import en from '@/messages/en.json';

describe('en.json budget namespace', () => {
  const required = [
    'loading', 'errorHeadline', 'errorSubtext',
    'summaryTitle', 'overall', 'spentOfPlanned', 'remaining', 'overBudget', 'noTarget',
    'byCategory', 'byDay', 'setBudget', 'editBudget',
    'addExpense', 'editExpense', 'amountLabel', 'categoryLabel', 'dateLabel',
    'noteLabel', 'linkPlaceLabel', 'noLinkedPlace', 'save', 'cancel', 'delete',
    'emptyHeadline', 'emptySubtext',
    'offlineHint', 'saveFailed', 'mutationFailed',
    'overallPlannedLabel', 'categoryPlannedLabel', 'clearTarget', 'dayTotal',
  ];
  const cats = ['food', 'lodging', 'transport', 'activities', 'shopping', 'other'];

  it('defines every budget UI key', () => {
    const b = (en as Record<string, Record<string, unknown>>).budget;
    expect(b).toBeDefined();
    for (const k of required) expect(b[k], `budget.${k}`).toBeTypeOf('string');
  });

  it('defines a label for every budget category', () => {
    const c = (en as Record<string, Record<string, Record<string, unknown>>>).budget.categories;
    expect(c).toBeDefined();
    for (const k of cats) expect(c[k], `budget.categories.${k}`).toBeTypeOf('string');
  });
});
