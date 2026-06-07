import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';

// The action module imports the singleton `db` from this path; we replace it
// with a per-test in-memory db.
const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
}));

// Spy on revalidatePath so we can assert the cache is busted.
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import {
  createTripAction,
  renameTripAction,
  shiftTripDatesAction,
  addTripDayAction,
  removeTripDayAction,
} from '@/app/_actions/trips';
import { getTrip } from '@/src/db/repos/trips';
import { addPlace, getPlace } from '@/src/db/repos/places';

describe('createTripAction', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    revalidatePath.mockClear();
  });

  it('creates a trip from a plain object and revalidates "/"', async () => {
    const trip = await createTripAction({
      name: 'Lisbon',
      startDate: '2026-05-01',
      endDate: '2026-05-08',
    });
    expect(trip.name).toBe('Lisbon');
    expect(getTrip(testHandle.db, trip.id)?.name).toBe('Lisbon');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('creates a trip from FormData', async () => {
    const fd = new FormData();
    fd.set('name', 'Porto');
    fd.set('startDate', '2026-05-01');
    fd.set('endDate', '2026-05-03');
    const trip = await createTripAction(fd);
    expect(trip.name).toBe('Porto');
  });

  it('rejects an empty name', async () => {
    await expect(
      createTripAction({ name: '', startDate: '2026-05-01', endDate: '2026-05-02' }),
    ).rejects.toThrow();
  });

  it('rejects endDate before startDate', async () => {
    await expect(
      createTripAction({ name: 'X', startDate: '2026-05-08', endDate: '2026-05-01' }),
    ).rejects.toThrow();
  });
});

describe('renameTripAction', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    revalidatePath.mockClear();
  });

  it('renames an existing trip and revalidates "/"', async () => {
    const trip = await createTripAction({
      name: 'Old',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    });
    revalidatePath.mockClear();
    await renameTripAction(trip.id, 'New');
    expect(getTrip(testHandle.db, trip.id)?.name).toBe('New');
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('rejects an empty name', async () => {
    await expect(renameTripAction('some-id', '')).rejects.toThrow();
  });

  it('throws when id does not exist', async () => {
    await expect(renameTripAction('nonexistent', 'X')).rejects.toThrow();
  });
});

describe('shiftTripDatesAction', () => {
  beforeEach(() => { testHandle.db = makeTestDb().db; revalidatePath.mockClear(); });

  it('moves the whole window and shifts scheduled places by the same delta', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-05-01', endDate: '2026-05-03' });
    const onDay = addPlace(testHandle.db, { tripId: trip.id, dayDate: '2026-05-02', name: 'Stop', category: 'other' });
    const saved = addPlace(testHandle.db, { tripId: trip.id, dayDate: null, name: 'Wishlist', category: 'other' });

    const updated = await shiftTripDatesAction(trip.id, '2026-05-04'); // +3 days
    expect(updated.startDate).toBe('2026-05-04');
    expect(updated.endDate).toBe('2026-05-06'); // length preserved (3 days)
    expect(getPlace(testHandle.db, onDay.id)?.dayDate).toBe('2026-05-05'); // 05-02 + 3
    expect(getPlace(testHandle.db, saved.id)?.dayDate).toBeNull(); // Saved untouched
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });
});

describe('addTripDayAction / removeTripDayAction', () => {
  beforeEach(() => { testHandle.db = makeTestDb().db; revalidatePath.mockClear(); });

  it('addTripDay extends the end by one day', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-05-01', endDate: '2026-05-03' });
    const updated = await addTripDayAction(trip.id);
    expect(updated.endDate).toBe('2026-05-04');
    expect(updated.startDate).toBe('2026-05-01');
  });

  it('removeTripDay shortens the end and moves the last day’s places to Saved', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-05-01', endDate: '2026-05-03' });
    const lastDay = addPlace(testHandle.db, { tripId: trip.id, dayDate: '2026-05-03', name: 'Last', category: 'other' });
    const updated = await removeTripDayAction(trip.id);
    expect(updated.endDate).toBe('2026-05-02');
    expect(getPlace(testHandle.db, lastDay.id)?.dayDate).toBeNull(); // moved to Saved, not deleted
  });

  it('removeTripDay refuses to remove the only day', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-05-01', endDate: '2026-05-01' });
    await expect(removeTripDayAction(trip.id)).rejects.toThrow();
  });
});
