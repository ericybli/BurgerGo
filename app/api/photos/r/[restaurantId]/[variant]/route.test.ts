import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, restaurants, placeDetailsCache } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

// Mock node:fs: readFileSync succeeds only for our known fixture path.
const PHOTO_BYTES = Buffer.from('FAKE_WEBP_DATA');
function fakeRead(path: string) {
  if (path.includes('grest-1')) return PHOTO_BYTES;
  throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
}
vi.mock('node:fs', () => ({
  default: { readFileSync: vi.fn(fakeRead) },
  readFileSync: vi.fn(fakeRead),
}));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

import { GET } from '@/app/api/photos/r/[restaurantId]/[variant]/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-05',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(restaurants).values({
    id: 'rest-1', tripId: 'trip-1', name: 'Ichiran', cuisine: null, rating: null,
    status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
    googlePlaceId: 'g-rest', createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(placeDetailsCache).values({
    googlePlaceId: 'g-rest', name: 'Ichiran', address: null, lat: null, lng: null,
    categoryGuess: 'other', photoRef: 'R', photoLocalPath: 'gphotos/grest-1.webp',
    rawJson: '{}', fetchedAt: TS,
  }).run();
}

function ctx(restaurantId: string, variant: string) {
  return { params: Promise.resolve({ restaurantId, variant }) };
}

describe('GET /api/photos/r/[restaurantId]/[variant]', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('streams the cached Google photo for a restaurant', async () => {
    const res = await GET(new Request('http://x/api/photos/r/rest-1/card'), ctx('rest-1', 'card'));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PHOTO_BYTES);
    expect(res.headers.get('content-type')).toMatch(/image/);
  });

  it('returns 404 for an unknown restaurant id', async () => {
    const res = await GET(new Request('http://x/api/photos/r/nope/card'), ctx('nope', 'card'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for a restaurant with no googlePlaceId', async () => {
    testHandle.db.insert(restaurants).values({
      id: 'no-gid', tripId: 'trip-1', name: 'Drop', cuisine: null, rating: null,
      status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
      googlePlaceId: null, createdAt: TS, updatedAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/photos/r/no-gid/card'), ctx('no-gid', 'card'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the cache row has no photoLocalPath', async () => {
    testHandle.db.insert(restaurants).values({
      id: 'no-photo', tripId: 'trip-1', name: 'Bare', cuisine: null, rating: null,
      status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
      googlePlaceId: 'g-bare', createdAt: TS, updatedAt: TS,
    }).run();
    testHandle.db.insert(placeDetailsCache).values({
      googlePlaceId: 'g-bare', name: 'Bare', address: null, lat: null, lng: null,
      categoryGuess: 'other', photoRef: null, photoLocalPath: null, rawJson: '{}', fetchedAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/photos/r/no-photo/card'), ctx('no-photo', 'card'));
    expect(res.status).toBe(404);
  });

  it('returns 404 (no read outside UPLOADS_DIR) when photoLocalPath traverses', async () => {
    testHandle.db.insert(restaurants).values({
      id: 'trav', tripId: 'trip-1', name: 'Traversal', cuisine: null, rating: null,
      status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
      googlePlaceId: 'g-trav', createdAt: TS, updatedAt: TS,
    }).run();
    testHandle.db.insert(placeDetailsCache).values({
      googlePlaceId: 'g-trav', name: 'Traversal', address: null, lat: null, lng: null,
      categoryGuess: 'other', photoRef: null, photoLocalPath: '../../etc/passwd',
      rawJson: '{}', fetchedAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/photos/r/trav/card'), ctx('trav', 'card'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('returns 404 for an invalid variant', async () => {
    const res = await GET(new Request('http://x/api/photos/r/rest-1/original'), ctx('rest-1', 'original'));
    expect(res.status).toBe(404);
  });
});
