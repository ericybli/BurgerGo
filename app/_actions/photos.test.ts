import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, photos } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; }, sqlite: {} }));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rmFn = vi.fn(async (..._args: any[]) => undefined);
vi.mock('node:fs/promises', () => ({
  default: { rm: (path: string, opts?: unknown) => rmFn(path, opts) },
  rm: (path: string, opts?: unknown) => rmFn(path, opts),
}));

import { deletePhotoAction } from '@/app/_actions/photos';
import { getPhoto } from '@/src/db/repos/photos';

const TS = new Date(1_700_000_000_000);

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'place-1', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
    name: 'Castle', address: null, lat: null, lng: null, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(photos).values({
    id: 'photo-1', tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1',
    path: 'trip-1/photo-1', width: 1600, height: 800, orderIndex: 0, createdAt: TS,
  }).run();
}

describe('deletePhotoAction', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
    rmFn.mockClear();
  });

  it('deletes the row, removes the dir, and revalidates the plan', async () => {
    await deletePhotoAction('photo-1');
    expect(getPhoto(testHandle.db, 'photo-1')).toBeUndefined();
    expect(rmFn).toHaveBeenCalledWith('/uploads/trip-1/photo-1', { recursive: true, force: true });
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
  });

  it('throws for an unknown photo id', async () => {
    await expect(deletePhotoAction('nope')).rejects.toThrow();
    expect(rmFn).not.toHaveBeenCalled();
  });
});
