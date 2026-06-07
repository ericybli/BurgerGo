import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, photos } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
const rm = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('node:fs/promises', () => ({
  default: { rm: (path: string, opts?: unknown) => rm(path, opts) },
  rm: (path: string, opts?: unknown) => rm(path, opts),
}));

import { addEntryAction, updateEntryAction, deleteEntryAction } from '@/app/_actions/journal';
import { getEntry, addEntry } from '@/src/db/repos/journalEntries';
import { listByOwner } from '@/src/db/repos/photos';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seedTrip() {
  testHandle.db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('journal actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seedTrip();
    revalidatePath.mockClear();
    rm.mockClear();
  });

  it('addEntryAction inserts an entry and revalidates the journal path', async () => {
    const entry = await addEntryAction({ tripId: 'trip-1', title: 'Day 1', body: '# hi', entryDate: '2026-06-05' });
    expect(entry.title).toBe('Day 1');
    expect(getEntry(testHandle.db, entry.id)).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
  });

  it('addEntryAction rejects an empty title', async () => {
    await expect(addEntryAction({ tripId: 'trip-1', title: '', body: '', entryDate: null }))
      .rejects.toThrow();
  });

  it('updateEntryAction patches an entry', async () => {
    const e = addEntry(testHandle.db, { tripId: 'trip-1', title: 'Old', body: '', entryDate: null });
    const updated = await updateEntryAction(e.id, { title: 'New', body: 'changed' });
    expect(updated.title).toBe('New');
    expect(updated.body).toBe('changed');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
  });

  it('updateEntryAction throws for a missing entry', async () => {
    await expect(updateEntryAction('ghost', { title: 'x' })).rejects.toThrow();
  });

  it('deleteEntryAction removes the entry, its photo rows, and their derivative dirs', async () => {
    const e = addEntry(testHandle.db, { tripId: 'trip-1', title: 'Bye', body: '', entryDate: null });
    testHandle.db.insert(photos).values({
      id: 'ph1', tripId: 'trip-1', ownerType: 'journal', ownerId: e.id,
      path: `trip-1/ph1`, width: 1, height: 1, orderIndex: 0, createdAt: TS,
    }).run();
    testHandle.db.insert(photos).values({
      id: 'ph2', tripId: 'trip-1', ownerType: 'journal', ownerId: e.id,
      path: `trip-1/ph2`, width: 1, height: 1, orderIndex: 1, createdAt: TS,
    }).run();

    await deleteEntryAction(e.id);

    expect(getEntry(testHandle.db, e.id)).toBeUndefined();
    expect(listByOwner(testHandle.db, 'journal', e.id)).toHaveLength(0);
    // one rm() per derivative dir, each strictly under the uploads root
    expect(rm).toHaveBeenCalledTimes(2);
    expect(rm).toHaveBeenCalledWith('/uploads/trip-1/ph1', { recursive: true, force: true });
    expect(rm).toHaveBeenCalledWith('/uploads/trip-1/ph2', { recursive: true, force: true });
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
  });

  it('deleteEntryAction throws for a missing entry', async () => {
    await expect(deleteEntryAction('ghost')).rejects.toThrow();
  });
});
