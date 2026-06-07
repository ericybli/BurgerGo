import { asc, eq, max } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import {
  packingCategories,
  packingItems,
  type PackingCategory,
  type PackingItem,
} from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { PackingCategory, PackingItem };

type Db = TestDb['db'];

// --- Categories -----------------------------------------------------------

/** A category by id, or undefined. */
export function getCategory(db: Db, id: string): PackingCategory | undefined {
  return db.select().from(packingCategories).where(eq(packingCategories.id, id)).get();
}

/** All categories for a trip, in display order (orderIndex asc, id tiebreak). */
export function listCategories(db: Db, tripId: string): PackingCategory[] {
  return db
    .select()
    .from(packingCategories)
    .where(eq(packingCategories.tripId, tripId))
    .orderBy(asc(packingCategories.orderIndex), asc(packingCategories.id))
    .all();
}

/** Next order index for a new category in this trip (max + 1, 0-based). */
function nextCategoryOrder(db: Db, tripId: string): number {
  const row = db
    .select({ m: max(packingCategories.orderIndex) })
    .from(packingCategories)
    .where(eq(packingCategories.tripId, tripId))
    .get();
  return (row?.m ?? -1) + 1;
}

/** Insert a category appended to the end; generates id + timestamps. */
export function addCategory(db: Db, tripId: string, name: string): PackingCategory {
  const ts = new Date(now());
  const row: PackingCategory = {
    id: newId(),
    tripId,
    name,
    orderIndex: nextCategoryOrder(db, tripId),
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(packingCategories).values(row).run();
  return row;
}

/** Rename a category; bumps updatedAt. Returns the row, or undefined. */
export function renameCategory(db: Db, id: string, name: string): PackingCategory | undefined {
  db.update(packingCategories)
    .set({ name, updatedAt: new Date(now()) })
    .where(eq(packingCategories.id, id))
    .run();
  return getCategory(db, id);
}

/** Delete a category; its items cascade via the FK. */
export function deleteCategory(db: Db, id: string): void {
  db.delete(packingCategories).where(eq(packingCategories.id, id)).run();
}

// --- Items ----------------------------------------------------------------

/** An item by id, or undefined. */
export function getItem(db: Db, id: string): PackingItem | undefined {
  return db.select().from(packingItems).where(eq(packingItems.id, id)).get();
}

/** Items in a category, in display order (orderIndex asc, id tiebreak). */
export function listItemsForCategory(db: Db, categoryId: string): PackingItem[] {
  return db
    .select()
    .from(packingItems)
    .where(eq(packingItems.categoryId, categoryId))
    .orderBy(asc(packingItems.orderIndex), asc(packingItems.id))
    .all();
}

/** Next order index for a new item in this category (max + 1, 0-based). */
function nextItemOrder(db: Db, categoryId: string): number {
  const row = db
    .select({ m: max(packingItems.orderIndex) })
    .from(packingItems)
    .where(eq(packingItems.categoryId, categoryId))
    .get();
  return (row?.m ?? -1) + 1;
}

export interface AddItemInput {
  categoryId: string;
  name: string;
  quantity?: number; // defaults to 1
}

/** Insert an item appended to the end of its category; defaults quantity 1, packed false. */
export function addItem(db: Db, input: AddItemInput): PackingItem {
  const ts = new Date(now());
  const row: PackingItem = {
    id: newId(),
    categoryId: input.categoryId,
    name: input.name,
    quantity: input.quantity ?? 1,
    packed: false,
    orderIndex: nextItemOrder(db, input.categoryId),
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(packingItems).values(row).run();
  return row;
}

/** Editable subset of an item (never id/categoryId/orderIndex/timestamps). */
export type ItemPatch = Partial<Pick<PackingItem, 'name' | 'quantity' | 'packed'>>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateItem(db: Db, id: string, patch: ItemPatch): PackingItem | undefined {
  db.update(packingItems)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(packingItems.id, id))
    .run();
  return getItem(db, id);
}

/** Delete an item. */
export function deleteItem(db: Db, id: string): void {
  db.delete(packingItems).where(eq(packingItems.id, id)).run();
}
