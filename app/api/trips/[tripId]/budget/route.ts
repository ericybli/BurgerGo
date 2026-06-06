import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listByTrip as listExpensesForTrip } from '@/src/db/repos/expenses';
import { listTargets as listTargetsForTrip } from '@/src/db/repos/budgetTargets';
import { places, type Expense, type BudgetTarget } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/** ExpenseDTO: all Expense fields + the linked place's name (or null). */
export interface ExpenseDTO extends Expense {
  placeName: string | null;
}

export type TargetDTO = BudgetTarget;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const rawExpenses = listExpensesForTrip(db, tripId);

  // Batch-resolve linked place names in one query (avoid N+1).
  const placeIds = rawExpenses
    .map((e) => e.linkedPlaceId)
    .filter((id): id is string => id !== null);

  const nameMap = new Map<string, string>();
  if (placeIds.length > 0) {
    const rows = db
      .select({ id: places.id, name: places.name })
      .from(places)
      .where(inArray(places.id, placeIds))
      .all();
    for (const row of rows) nameMap.set(row.id, row.name);
  }

  const expenses: ExpenseDTO[] = rawExpenses.map((e) => ({
    ...e,
    placeName: e.linkedPlaceId ? (nameMap.get(e.linkedPlaceId) ?? null) : null,
  }));

  const targets: TargetDTO[] = listTargetsForTrip(db, tripId);

  return NextResponse.json({ expenses, targets });
}
