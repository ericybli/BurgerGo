import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

import {
  addCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  addItemAction,
  updateItemAction,
  deleteItemAction,
} from '@/app/_actions/packing';
import { getCategory, getItem, listCategories } from '@/src/db/repos/packing';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed() {
  testHandle.db = makeTestDb().db;
  testHandle.db
    .insert(trips)
    .values({
      id: 't1',
      name: 'Osaka',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      coverPhoto: null,
      createdAt: TS,
      updatedAt: TS,
    })
    .run();
}

beforeEach(() => {
  revalidatePath.mockClear();
  seed();
});

describe('packing actions', () => {
  it('addCategoryAction creates a category (trimmed) and revalidates', async () => {
    const cat = await addCategoryAction('t1', '  Clothes  ');
    expect(cat.name).toBe('Clothes');
    expect(getCategory(testHandle.db, cat.id)).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/packing');
  });

  it('addCategoryAction rejects an empty name', async () => {
    await expect(addCategoryAction('t1', '   ')).rejects.toThrow();
  });

  it('renameCategoryAction updates the name and revalidates', async () => {
    const cat = await addCategoryAction('t1', 'Old');
    revalidatePath.mockClear();
    const updated = await renameCategoryAction(cat.id, 'New');
    expect(updated.name).toBe('New');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/packing');
  });

  it('deleteCategoryAction removes the category', async () => {
    const cat = await addCategoryAction('t1', 'Clothes');
    await deleteCategoryAction(cat.id);
    expect(listCategories(testHandle.db, 't1')).toHaveLength(0);
  });

  it('addItemAction creates an item with quantity and revalidates', async () => {
    const cat = await addCategoryAction('t1', 'Clothes');
    revalidatePath.mockClear();
    const item = await addItemAction({ categoryId: cat.id, name: 'Socks', quantity: 3 });
    expect(item.name).toBe('Socks');
    expect(item.quantity).toBe(3);
    expect(item.packed).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/packing');
  });

  it('addItemAction defaults quantity to 1 and rejects bad input', async () => {
    const cat = await addCategoryAction('t1', 'Clothes');
    const item = await addItemAction({ categoryId: cat.id, name: 'Hat' });
    expect(item.quantity).toBe(1);
    await expect(addItemAction({ categoryId: cat.id, name: '  ' })).rejects.toThrow();
    await expect(addItemAction({ categoryId: cat.id, name: 'X', quantity: 0 })).rejects.toThrow();
  });

  it('addItemAction throws for an unknown category', async () => {
    await expect(addItemAction({ categoryId: 'nope', name: 'X' })).rejects.toThrow();
  });

  it('updateItemAction toggles packed and patches fields', async () => {
    const cat = await addCategoryAction('t1', 'Clothes');
    const item = await addItemAction({ categoryId: cat.id, name: 'Socks' });
    revalidatePath.mockClear();
    const updated = await updateItemAction(item.id, { packed: true, quantity: 2, name: 'Wool socks' });
    expect(updated.packed).toBe(true);
    expect(updated.quantity).toBe(2);
    expect(updated.name).toBe('Wool socks');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/packing');
  });

  it('deleteItemAction removes the item and revalidates', async () => {
    const cat = await addCategoryAction('t1', 'Clothes');
    const item = await addItemAction({ categoryId: cat.id, name: 'Socks' });
    revalidatePath.mockClear();
    await deleteItemAction(item.id);
    expect(getItem(testHandle.db, item.id)).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/packing');
  });
});
