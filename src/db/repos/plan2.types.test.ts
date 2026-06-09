import { describe, it, expectTypeOf, expect } from 'vitest';
import type {
  Restaurant,
  Expense,
  BudgetTarget,
  Photo,
  ExpenseCategory,
  RestaurantStatus,
  PhotoOwnerType,
  TargetCategory,
} from '@/src/db/repos/plan2.types';

describe('plan2 DTO type barrel', () => {
  it('re-exports the four row types with expected key shapes', () => {
    expectTypeOf<Restaurant>().toHaveProperty('linkedPlaceId');
    expectTypeOf<Expense>().toHaveProperty('spentOn');
    expectTypeOf<BudgetTarget>().toHaveProperty('plannedAmount');
    expectTypeOf<Photo>().toHaveProperty('orderIndex');
  });

  it('re-exports the enum/union helper types', () => {
    expectTypeOf<RestaurantStatus>().toEqualTypeOf<'want-to-try' | 'been'>();
    expectTypeOf<PhotoOwnerType>().toEqualTypeOf<'place' | 'journal' | 'restaurant' | 'photo_list'>();
    expectTypeOf<ExpenseCategory>().toEqualTypeOf<
      'food' | 'lodging' | 'transport' | 'activities' | 'shopping' | 'other'
    >();
    // overall target = null category
    expectTypeOf<TargetCategory>().toEqualTypeOf<ExpenseCategory | null>();
  });

  it('placeholder runtime assertion so the file runs as a test', () => {
    expect(true).toBe(true);
  });
});
