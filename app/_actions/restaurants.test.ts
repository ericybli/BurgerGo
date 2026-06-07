import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

import {
  addRestaurantAction,
  updateRestaurantAction,
  deleteRestaurantAction,
  scheduleRestaurantToDayAction,
  unscheduleRestaurantAction,
} from '@/app/_actions/restaurants';
import { getRestaurant } from '@/src/db/repos/restaurants';
import { getPlace } from '@/src/db/repos/places';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed() {
  testHandle.db = makeTestDb().db;
  testHandle.db.insert(trips).values({
    id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

beforeEach(() => {
  revalidatePath.mockClear();
  seed();
});

describe('restaurant actions', () => {
  it('addRestaurantAction validates + inserts and revalidates the eats tab', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: '  Ichiran  ', status: 'want-to-try' });
    expect(r.name).toBe('Ichiran'); // trimmed
    expect(getRestaurant(testHandle.db, r.id)).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
  });

  it('addRestaurantAction rejects an empty name', async () => {
    await expect(addRestaurantAction({ tripId: 't1', name: '   ', status: 'want-to-try' })).rejects.toThrow();
  });

  it('addRestaurantAction stores address/coords/googlePlaceId', async () => {
    const r = await addRestaurantAction({
      tripId: 't1', name: 'Ichiran', status: 'want-to-try',
      address: '1-2-3 Shibuya', lat: 35.66, lng: 139.7, googlePlaceId: 'gx',
    });
    expect(r.address).toBe('1-2-3 Shibuya');
    expect(r.lat).toBe(35.66);
    expect(r.lng).toBe(139.7);
    expect(r.googlePlaceId).toBe('gx');
  });

  it('addRestaurantAction rejects out-of-range coordinates', async () => {
    await expect(
      addRestaurantAction({ tripId: 't1', name: 'A', status: 'been', lat: 999, lng: 0 }),
    ).rejects.toThrow();
  });

  it('addRestaurantAction rejects rating out of 1–5 and price out of 1–4', async () => {
    await expect(addRestaurantAction({ tripId: 't1', name: 'A', status: 'been', rating: 6 })).rejects.toThrow();
    await expect(addRestaurantAction({ tripId: 't1', name: 'A', status: 'been', priceLevel: 5 })).rejects.toThrow();
  });

  it('updateRestaurantAction patches and revalidates', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'want-to-try' });
    revalidatePath.mockClear();
    const updated = await updateRestaurantAction(r.id, { status: 'been', rating: 5 });
    expect(updated.status).toBe('been');
    expect(updated.rating).toBe(5);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
  });

  it('updateRestaurantAction throws for an unknown id', async () => {
    await expect(updateRestaurantAction('nope', { status: 'been' })).rejects.toThrow('Restaurant not found');
  });

  it('deleteRestaurantAction removes the row + revalidates', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'been' });
    await deleteRestaurantAction(r.id);
    expect(getRestaurant(testHandle.db, r.id)).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
  });

  it('scheduleRestaurantToDayAction creates a linked place and revalidates eats + plan', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'want-to-try', notes: 'n' });
    revalidatePath.mockClear();
    const res = await scheduleRestaurantToDayAction(r.id, '2026-06-06');
    expect(res.place.dayDate).toBe('2026-06-06');
    expect(res.place.category).toBe('other');
    expect(res.restaurant.linkedPlaceId).toBe(res.place.id);
    expect(getPlace(testHandle.db, res.place.id)?.notes).toBe('n');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/eats');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/plan');
  });

  it('scheduleRestaurantToDayAction rejects a malformed date', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'want-to-try' });
    await expect(scheduleRestaurantToDayAction(r.id, '06/06/2026')).rejects.toThrow();
  });

  it('unscheduleRestaurantAction deletes the linked place + clears the link', async () => {
    const r = await addRestaurantAction({ tripId: 't1', name: 'A', status: 'been' });
    const { place } = await scheduleRestaurantToDayAction(r.id, '2026-06-06');
    const updated = await unscheduleRestaurantAction(r.id);
    expect(updated.linkedPlaceId).toBeNull();
    expect(getPlace(testHandle.db, place.id)).toBeUndefined();
  });
});
