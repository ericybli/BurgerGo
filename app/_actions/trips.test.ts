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

import { createTripAction, renameTripAction } from '@/app/_actions/trips';
import { getTrip } from '@/src/db/repos/trips';

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
