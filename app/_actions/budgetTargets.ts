'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  setTarget,
  deleteTarget,
  type BudgetTarget,
  type TargetCategory,
} from '@/src/db/repos/budgetTargets';

const category = z.enum([
  'food', 'lodging', 'transport', 'activities', 'shopping', 'other',
]);
// null = the overall (whole-trip) target.
const targetCategory = category.nullable();

function revalidateBudget(tripId: string): void {
  revalidatePath(`/trip/${tripId}/budget`);
}

// --- setTargetAction ------------------------------------------------------

const setSchema = z.object({
  tripId: z.string().min(1),
  category: targetCategory,
  plannedAmount: z
    .number()
    .int('Planned amount must be whole minor units')
    .positive('Planned amount must be greater than zero'),
});

export type SetTargetActionInput = z.input<typeof setSchema>;

export async function setTargetAction(input: SetTargetActionInput): Promise<BudgetTarget> {
  const data = setSchema.parse(input);
  const target = setTarget(db, data.tripId, data.category, data.plannedAmount);
  revalidateBudget(data.tripId);
  return target;
}

// --- clearTargetAction ----------------------------------------------------

export async function clearTargetAction(
  tripId: string,
  category: TargetCategory,
): Promise<void> {
  const parsedTrip = z.string().min(1).parse(tripId);
  const parsedCategory = targetCategory.parse(category);
  deleteTarget(db, parsedTrip, parsedCategory);
  revalidateBudget(parsedTrip);
}
