'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  addExpense,
  updateExpense,
  deleteExpense,
  getExpense,
  type Expense,
} from '@/src/db/repos/expenses';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const amount = z
  .number()
  .int('Amount must be whole minor units')
  .positive('Amount must be greater than zero');
const category = z.enum([
  'food', 'lodging', 'transport', 'activities', 'shopping', 'other',
]);

function revalidateBudget(tripId: string): void {
  revalidatePath(`/trip/${tripId}/budget`);
}

// --- addExpenseAction -----------------------------------------------------

const addSchema = z.object({
  tripId: z.string().min(1),
  amount,
  category,
  spentOn: dateStr,
  note: z.string().max(2000).nullish(),
  linkedPlaceId: z.string().min(1).nullish(),
});

export type AddExpenseActionInput = z.input<typeof addSchema>;

export async function addExpenseAction(input: AddExpenseActionInput): Promise<Expense> {
  const data = addSchema.parse(input);
  const expense = addExpense(db, {
    tripId: data.tripId,
    amount: data.amount,
    category: data.category,
    spentOn: data.spentOn,
    note: data.note ?? null,
    linkedPlaceId: data.linkedPlaceId ?? null,
  });
  revalidateBudget(data.tripId);
  return expense;
}

// --- updateExpenseAction --------------------------------------------------

const updateSchema = z.object({
  amount: amount.optional(),
  category: category.optional(),
  spentOn: dateStr.optional(),
  note: z.string().max(2000).nullish(),
  linkedPlaceId: z.string().min(1).nullish(),
});

export type UpdateExpenseActionPatch = z.input<typeof updateSchema>;

export async function updateExpenseAction(
  id: string,
  patch: UpdateExpenseActionPatch,
): Promise<Expense> {
  const existing = getExpense(db, id);
  if (!existing) throw new Error('Expense not found');
  const data = updateSchema.parse(patch);
  const updated = updateExpense(db, id, data);
  if (!updated) throw new Error('Expense not found');
  revalidateBudget(existing.tripId);
  return updated;
}

// --- deleteExpenseAction --------------------------------------------------

export async function deleteExpenseAction(id: string): Promise<void> {
  const existing = getExpense(db, id);
  if (!existing) throw new Error('Expense not found');
  deleteExpense(db, id);
  revalidateBudget(existing.tripId);
}
