import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import { listByTrip } from '@/src/db/repos/savedLists';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; } }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

import { addSavedListAction, renameSavedListAction, deleteSavedListAction } from '@/app/_actions/savedLists';

const TS = new Date('2026-06-08T12:00:00.000Z');

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  testHandle.db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  revalidatePath.mockClear();
});

describe('savedLists actions', () => {
  it('adds a list (trimmed) and revalidates the plan', async () => {
    const row = await addSavedListAction('trip-1', '  Beaches  ');
    expect(row.name).toBe('Beaches');
    expect(listByTrip(testHandle.db, 'trip-1')).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
  });

  it('rejects an empty name and an unknown trip', async () => {
    await expect(addSavedListAction('trip-1', '   ')).rejects.toThrow();
    await expect(addSavedListAction('nope', 'X')).rejects.toThrow('Trip not found');
  });

  it('renames then deletes a list', async () => {
    const l = await addSavedListAction('trip-1', 'Old');
    await renameSavedListAction('trip-1', l.id, 'New');
    expect(listByTrip(testHandle.db, 'trip-1')[0]!.name).toBe('New');
    await deleteSavedListAction('trip-1', l.id);
    expect(listByTrip(testHandle.db, 'trip-1')).toEqual([]);
  });
});
