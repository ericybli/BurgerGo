/**
 * DTO-friendly type barrel for the Plan 2 data layer. API read-handlers,
 * server actions, and UI import the row + enum/union types from here without
 * depending on each repo's implementation file. (Mirrors the per-repo
 * `export type { ... }` re-exports already used in places/legs.)
 */
export type {
  Restaurant,
  Expense,
  BudgetTarget,
  Photo,
  NewRestaurant,
  NewExpense,
  NewBudgetTarget,
  NewPhoto,
} from '@/src/db/schema';

export type { RestaurantStatus } from '@/src/db/repos/restaurants';
export type { ExpenseCategory, CategoryTotal, DayTotal } from '@/src/db/repos/expenses';
export type { TargetCategory } from '@/src/db/repos/budgetTargets';
export type { PhotoOwnerType } from '@/src/db/repos/photos';
