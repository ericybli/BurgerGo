// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { getPrincipal } from '@/src/lib/authz';
import { trips, places, photos } from '@/src/db/schema';
import { getPhoto } from '@/src/db/repos/photos';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const rm = vi.fn(async (..._a: unknown[]) => {});
vi.mock('node:fs/promises', () => ({ rm: (...a: unknown[]) => rm(...a) }));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

import { DELETE } from '@/app/api/photos/p/[photoId]/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

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

const ctx = (photoId: string) => ({ params: Promise.resolve({ photoId }) });
const del = () => new Request('http://x/api/photos/p/photo-1', { method: 'DELETE' });

describe('DELETE /api/photos/p/[photoId]', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    rm.mockClear();
    delete process.env.BURGERGO_API_KEY;
  });

  it('deletes the photo row and removes its on-disk derivatives', async () => {
    const res = await DELETE(del(), ctx('photo-1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(getPhoto(testHandle.db, 'photo-1')).toBeUndefined();
    expect(rm).toHaveBeenCalledWith('/uploads/trip-1/photo-1', { recursive: true, force: true });
  });

  it('returns 404 for an unknown photo', async () => {
    const res = await DELETE(del(), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(getPrincipal).mockResolvedValueOnce(null);
    const noAuth = await DELETE(del(), ctx('photo-1'));
    expect(noAuth.status).toBe(401);
    const withAuth = await DELETE(del(), ctx('photo-1'));
    expect(withAuth.status).toBe(200);
  });
});
