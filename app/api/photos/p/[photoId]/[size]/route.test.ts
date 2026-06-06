// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, photos } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

const PHOTO_BYTES = Buffer.from('FAKE_WEBP_DATA');
vi.mock('node:fs/promises', () => {
  const read = async (path: string) => {
    if (path.includes('photo-1') && path.endsWith('card.webp')) return PHOTO_BYTES;
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    throw err;
  };
  return { default: { readFile: vi.fn(read) }, readFile: vi.fn(read) };
});
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

import { GET } from '@/app/api/photos/p/[photoId]/[size]/route';

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

function ctx(photoId: string, size: string) {
  return { params: Promise.resolve({ photoId, size }) };
}

describe('GET /api/photos/p/[photoId]/[size]', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('streams the requested size webp for a known photo', async () => {
    const res = await GET(new Request('http://x/api/photos/p/photo-1/card'), ctx('photo-1', 'card'));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PHOTO_BYTES);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('returns 404 for an unknown photo id', async () => {
    const res = await GET(new Request('http://x/api/photos/p/nope/card'), ctx('nope', 'card'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for an invalid size', async () => {
    const res = await GET(new Request('http://x/api/photos/p/photo-1/huge'), ctx('photo-1', 'huge'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('not_found');
  });

  it('returns 404 when the file is missing on disk', async () => {
    // 'thumb' is valid but the fs mock only returns bytes for card.webp.
    const res = await GET(new Request('http://x/api/photos/p/photo-1/thumb'), ctx('photo-1', 'thumb'));
    expect(res.status).toBe(404);
  });

  it('returns 404 (no read outside UPLOADS_DIR) when the stored path traverses out', async () => {
    testHandle.db.insert(photos).values({
      id: 'trav', tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1',
      path: '../../etc', width: null, height: null, orderIndex: 1, createdAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/photos/p/trav/card'), ctx('trav', 'card'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('not_found');
  });
});
