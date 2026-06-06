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
    const b: Record<string, unknown> = en.budget as unknown as Record<string, unknown>;
    expect(b).toBeDefined();
    for (const k of required) expect(b[k], `budget.${k}`).toBeTypeOf('string');
  });

  it('defines a label for every budget category', () => {
    const b: Record<string, unknown> = en.budget as unknown as Record<string, unknown>;
    const c: Record<string, unknown> = b.categories as Record<string, unknown>;
    expect(c).toBeDefined();
    for (const k of cats) expect(c[k], `budget.categories.${k}`).toBeTypeOf('string');
  });
});
