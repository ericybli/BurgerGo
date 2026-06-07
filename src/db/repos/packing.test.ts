import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip, deleteTrip } from '@/src/db/repos/trips';
import {
  addCategory,
  listCategories,
  getCategory,
  renameCategory,
  deleteCategory,
  addItem,
  getItem,
  listItemsForCategory,
  updateItem,
  deleteItem,
} from '@/src/db/repos/packing';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db } = makeTestDb();
  const trip = createTrip(db, { name: 'Tokyo', startDate: '2026-06-01', endDate: '2026-06-10' });
  return { db, tripId: trip.id };
}

describe('packing repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addCategory inserts with generated id/timestamps and appends order', () => {
    const { db, tripId } = setup();
    const a = addCategory(db, tripId, 'Clothes');
    const b = addCategory(db, tripId, 'Toiletries');
    expect(a.id).toMatch(/[0-9a-f-]{36}/);
    expect(a.orderIndex).toBe(0);
    expect(b.orderIndex).toBe(1);
    expect(a.createdAt).toEqual(NOW);
    expect(getCategory(db, a.id)?.name).toBe('Clothes');
  });

  it('listCategories returns trip categories in order', () => {
    const { db, tripId } = setup();
    addCategory(db, tripId, 'A');
    addCategory(db, tripId, 'B');
    expect(listCategories(db, tripId).map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('renameCategory updates the name', () => {
    const { db, tripId } = setup();
    const c = addCategory(db, tripId, 'Old');
    expect(renameCategory(db, c.id, 'New')?.name).toBe('New');
  });

  it('addItem defaults quantity 1 and packed false, appends order', () => {
    const { db, tripId } = setup();
    const cat = addCategory(db, tripId, 'Clothes');
    const i1 = addItem(db, { categoryId: cat.id, name: 'Socks' });
    const i2 = addItem(db, { categoryId: cat.id, name: 'Shirt', quantity: 3 });
    expect(i1.quantity).toBe(1);
    expect(i1.packed).toBe(false);
    expect(i1.orderIndex).toBe(0);
    expect(i2.quantity).toBe(3);
    expect(i2.orderIndex).toBe(1);
  });

  it('listItemsForCategory returns items in order', () => {
    const { db, tripId } = setup();
    const cat = addCategory(db, tripId, 'Clothes');
    addItem(db, { categoryId: cat.id, name: 'Socks' });
    addItem(db, { categoryId: cat.id, name: 'Shirt' });
    expect(listItemsForCategory(db, cat.id).map((i) => i.name)).toEqual(['Socks', 'Shirt']);
  });

  it('updateItem patches name, quantity, and packed', () => {
    const { db, tripId } = setup();
    const cat = addCategory(db, tripId, 'Clothes');
    const item = addItem(db, { categoryId: cat.id, name: 'Socks' });
    const updated = updateItem(db, item.id, { name: 'Wool socks', quantity: 2, packed: true });
    expect(updated?.name).toBe('Wool socks');
    expect(updated?.quantity).toBe(2);
    expect(updated?.packed).toBe(true);
  });

  it('deleteItem removes the row', () => {
    const { db, tripId } = setup();
    const cat = addCategory(db, tripId, 'Clothes');
    const item = addItem(db, { categoryId: cat.id, name: 'Socks' });
    deleteItem(db, item.id);
    expect(getItem(db, item.id)).toBeUndefined();
  });

  it('deleting a category cascades to its items', () => {
    const { db, tripId } = setup();
    const cat = addCategory(db, tripId, 'Clothes');
    const item = addItem(db, { categoryId: cat.id, name: 'Socks' });
    deleteCategory(db, cat.id);
    expect(getCategory(db, cat.id)).toBeUndefined();
    expect(getItem(db, item.id)).toBeUndefined();
  });

  it('deleting a trip cascades to categories and their items', () => {
    const { db, tripId } = setup();
    const cat = addCategory(db, tripId, 'Clothes');
    const item = addItem(db, { categoryId: cat.id, name: 'Socks' });
    deleteTrip(db, tripId);
    expect(getCategory(db, cat.id)).toBeUndefined();
    expect(getItem(db, item.id)).toBeUndefined();
  });
});
