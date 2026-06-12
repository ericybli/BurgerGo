'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  addCategory,
  renameCategory,
  deleteCategory,
  getCategory,
  addItem,
  updateItem,
  deleteItem,
  getItem,
  type PackingCategory,
  type PackingItem,
} from '@/src/db/repos/packing';
import { requireUserAction, requireTripMember } from '@/src/lib/authz';

const nameField = z.string().trim().min(1, 'Name is required').max(100);
const quantityField = z.number().int().min(1).max(9999);

function revalidatePacking(tripId: string): void {
  revalidatePath(`/trip/${tripId}/packing`);
}

// --- Categories -----------------------------------------------------------

export async function addCategoryAction(tripId: string, rawName: string): Promise<PackingCategory> {
  const principal = await requireUserAction();
  const trip = z.string().min(1).parse(tripId);
  requireTripMember(principal, trip);
  const name = nameField.parse(rawName);
  const cat = addCategory(db, trip, name);
  revalidatePacking(trip);
  return cat;
}

export async function renameCategoryAction(id: string, rawName: string): Promise<PackingCategory> {
  const principal = await requireUserAction();
  const existing = getCategory(db, id);
  if (!existing) throw new Error('Category not found');
  requireTripMember(principal, existing.tripId);
  const name = nameField.parse(rawName);
  const updated = renameCategory(db, id, name);
  if (!updated) throw new Error('Category not found');
  revalidatePacking(existing.tripId);
  return updated;
}

export async function deleteCategoryAction(id: string): Promise<void> {
  const principal = await requireUserAction();
  const existing = getCategory(db, id);
  if (!existing) throw new Error('Category not found');
  requireTripMember(principal, existing.tripId);
  deleteCategory(db, id);
  revalidatePacking(existing.tripId);
}

// --- Items ----------------------------------------------------------------

const addItemSchema = z.object({
  categoryId: z.string().min(1),
  name: nameField,
  quantity: quantityField.optional(),
});

export type AddItemActionInput = z.input<typeof addItemSchema>;

export async function addItemAction(input: AddItemActionInput): Promise<PackingItem> {
  const principal = await requireUserAction();
  const data = addItemSchema.parse(input);
  const cat = getCategory(db, data.categoryId);
  if (!cat) throw new Error('Category not found');
  requireTripMember(principal, cat.tripId);
  const item = addItem(db, {
    categoryId: data.categoryId,
    name: data.name,
    quantity: data.quantity,
  });
  revalidatePacking(cat.tripId);
  return item;
}

const updateItemSchema = z.object({
  name: nameField.optional(),
  quantity: quantityField.optional(),
  packed: z.boolean().optional(),
});

export type UpdateItemActionPatch = z.input<typeof updateItemSchema>;

export async function updateItemAction(
  id: string,
  patch: UpdateItemActionPatch,
): Promise<PackingItem> {
  const principal = await requireUserAction();
  const item = getItem(db, id);
  if (!item) throw new Error('Item not found');
  const cat = getCategory(db, item.categoryId);
  if (!cat) throw new Error('Category not found');
  requireTripMember(principal, cat.tripId);
  const data = updateItemSchema.parse(patch);
  const updated = updateItem(db, id, data);
  if (!updated) throw new Error('Item not found');
  revalidatePacking(cat.tripId);
  return updated;
}

export async function deleteItemAction(id: string): Promise<void> {
  const principal = await requireUserAction();
  const item = getItem(db, id);
  if (!item) throw new Error('Item not found');
  const cat = getCategory(db, item.categoryId);
  if (cat) requireTripMember(principal, cat.tripId);
  deleteItem(db, id);
  if (cat) revalidatePacking(cat.tripId);
}
