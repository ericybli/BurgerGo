import { asc, desc, eq, sql } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { expenses, type Expense } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Expense };

type Db = TestDb['db'];

export type ExpenseCategory = Expense['category'];

/** One expense by id, or undefined. */
export function getExpense(db: Db, id: string): Expense | undefined {
  return db.select().from(expenses).where(eq(expenses.id, id)).get();
}

/**
 * All expenses for a trip, by spent_on date descending then createdAt
 * descending — the §4.2 "grouped by date, newest first" feed order.
 * Aliased as `listExpensesForTrip` for C3 compatibility.
 */
export function listByTrip(db: Db, tripId: string): Expense[] {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt))
    .all();
}

export interface AddExpenseInput {
  tripId: string;
  amount: number; // integer minor units
  category: ExpenseCategory;
  spentOn: string; // YYYY-MM-DD
  note?: string | null;
  linkedPlaceId?: string | null;
}

/** Insert an expense; generates id + timestamps. */
export function addExpense(db: Db, input: AddExpenseInput): Expense {
  const ts = new Date(now());
  const row: Expense = {
    id: newId(),
    tripId: input.tripId,
    amount: input.amount,
    category: input.category,
    spentOn: input.spentOn,
    note: input.note ?? null,
    linkedPlaceId: input.linkedPlaceId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(expenses).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type ExpensePatch = Partial<
  Pick<Expense, 'amount' | 'category' | 'spentOn' | 'note' | 'linkedPlaceId'>
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateExpense(
  db: Db,
  id: string,
  patch: ExpensePatch,
): Expense | undefined {
  db.update(expenses)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(expenses.id, id))
    .run();
  return getExpense(db, id);
}

/** Alias for listByTrip (C3 API compatibility). */
export const listExpensesForTrip = listByTrip;

/** Delete an expense. */
export function deleteExpense(db: Db, id: string): void {
  db.delete(expenses).where(eq(expenses.id, id)).run();
}

export interface CategoryTotal {
  category: ExpenseCategory;
  total: number; // minor units
}

/** Summed actual spend per category present, ordered by category name. */
export function totalsByCategory(db: Db, tripId: string): CategoryTotal[] {
  const rows = db
    .select({
      category: expenses.category,
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .groupBy(expenses.category)
    .orderBy(asc(expenses.category))
    .all();
  return rows.map((r) => ({ category: r.category, total: Number(r.total) }));
}

export interface DayTotal {
  spentOn: string; // YYYY-MM-DD
  total: number; // minor units
}

/** Summed actual spend per spent_on date, descending. */
export function totalsByDay(db: Db, tripId: string): DayTotal[] {
  const rows = db
    .select({
      spentOn: expenses.spentOn,
      total: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .groupBy(expenses.spentOn)
    .orderBy(desc(expenses.spentOn))
    .all();
  return rows.map((r) => ({ spentOn: r.spentOn, total: Number(r.total) }));
}

/** Grand total actual spend for the trip (minor units); 0 when empty. */
export function totalForTrip(db: Db, tripId: string): number {
  const row = db
    .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .get();
  return Number(row?.total ?? 0);
}
