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

  it('throws and does NOT call rm when the DB path traverses outside UPLOADS_DIR', async () => {
    // Insert a photo row with a malicious path that would escape UPLOADS_DIR.
    testHandle.db.insert(photos).values({
      id: 'bad-photo', tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1',
      path: '../../etc', width: null, height: null, orderIndex: 1, createdAt: TS,
    }).run();

    await expect(deletePhotoAction('bad-photo')).rejects.toThrow('Invalid photo path');
    expect(rmFn).not.toHaveBeenCalled();
  });

  it('throws and does NOT rm when the DB path resolves to the uploads root itself', async () => {
    // An empty `path` would resolve to UPLOADS_DIR — recursively deleting it
    // would wipe every trip's photos. The guard must reject it.
    testHandle.db.insert(photos).values({
      id: 'root-photo', tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1',
      path: '', width: null, height: null, orderIndex: 2, createdAt: TS,
    }).run();

    await expect(deletePhotoAction('root-photo')).rejects.toThrow('Invalid photo path');
    expect(rmFn).not.toHaveBeenCalled();
  });
});
