import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import { addCategory, addItem } from '@/src/db/repos/packing';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/packing/route';

function call(tripId: string) {
  return GET(new Request('http://t/'), { params: Promise.resolve({ tripId }) });
}

beforeEach(() => {
  testHandle.db = makeTestDb().db;
});

describe('GET /api/trips/[tripId]/packing', () => {
  it('returns 404 for an unknown trip', async () => {
    const res = await call('nope');
    expect(res.status).toBe(404);
  });

  it('returns categories with their items nested and ordered', async () => {
    const db = testHandle.db;
    const trip = createTrip(db, { name: 'Tokyo', startDate: '2026-06-01', endDate: '2026-06-10' });
    const clothes = addCategory(db, trip.id, 'Clothes');
    addCategory(db, trip.id, 'Toiletries');
    addItem(db, { categoryId: clothes.id, name: 'Socks', quantity: 2 });
    addItem(db, { categoryId: clothes.id, name: 'Shirt' });

    const res = await call(trip.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      categories: { name: string; items: { name: string; quantity: number; packed: boolean }[] }[];
    };
    expect(body.categories.map((c) => c.name)).toEqual(['Clothes', 'Toiletries']);
    expect(body.categories[0]!.items.map((i) => i.name)).toEqual(['Socks', 'Shirt']);
    expect(body.categories[0]!.items[0]!.quantity).toBe(2);
    expect(body.categories[0]!.items[0]!.packed).toBe(false);
    expect(body.categories[1]!.items).toEqual([]);
  });
});
