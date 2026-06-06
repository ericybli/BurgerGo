import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { budgetTargets, type BudgetTarget } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { BudgetTarget };

type Db = TestDb['db'];

/** A non-null expense category, or `null` for the overall trip target. */
export type TargetCategory = BudgetTarget['category'];

/** Match-by-trip-and-category condition; uses IS NULL for the overall row. */
function whereTripCat(tripId: string, category: TargetCategory) {
  return category === null
    ? and(eq(budgetTargets.tripId, tripId), isNull(budgetTargets.category))
    : and(eq(budgetTargets.tripId, tripId), eq(budgetTargets.category, category));
}

/** The per-category target for a trip, or undefined. */
export function getTarget(
  db: Db,
  tripId: string,
  category: Exclude<TargetCategory, null>,
): BudgetTarget | undefined {
  return db
    .select()
    .from(budgetTargets)
    .where(whereTripCat(tripId, category))
    .get();
}

/** The overall (category NULL) target for a trip, or undefined. */
export function getOverallTarget(
  db: Db,
  tripId: string,
): BudgetTarget | undefined {
  return db
    .select()
    .from(budgetTargets)
    .where(whereTripCat(tripId, null))
    .get();
}

/**
 * All targets for a trip: overall (category NULL) first, then per-category
 * rows alphabetically. NULL sorts first via `category IS NOT NULL`.
 */
export function listTargets(db: Db, tripId: string): BudgetTarget[] {
  return db
    .select()
    .from(budgetTargets)
    .where(eq(budgetTargets.tripId, tripId))
    .orderBy(sql`${budgetTargets.category} IS NOT NULL`, asc(budgetTargets.category))
    .all();
}

/**
 * Set the planned amount for (trip, category). `category = null` is the overall
 * target. Upserts via read-before-write: SQLite treats each NULL as distinct in
 * a UNIQUE index, so we cannot use onConflict for the overall row. Existing
 * rows keep their id + createdAt; only plannedAmount + updatedAt change.
 */
export function setTarget(
  db: Db,
  tripId: string,
  category: TargetCategory,
  plannedAmount: number,
): BudgetTarget {
  const ts = new Date(now());
  const existing = db
    .select()
    .from(budgetTargets)
    .where(whereTripCat(tripId, category))
    .get();

  if (existing) {
    db.update(budgetTargets)
      .set({ plannedAmount, updatedAt: ts })
      .where(eq(budgetTargets.id, existing.id))
      .run();
    return { ...existing, plannedAmount, updatedAt: ts };
  }

  const row: BudgetTarget = {
    id: newId(),
    tripId,
    category,
    plannedAmount,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(budgetTargets).values(row).run();
  return row;
}

/** Delete the target for (trip, category). `category = null` deletes overall. */
export function deleteTarget(
  db: Db,
  tripId: string,
  category: TargetCategory,
): void {
  db.delete(budgetTargets).where(whereTripCat(tripId, category)).run();
}
