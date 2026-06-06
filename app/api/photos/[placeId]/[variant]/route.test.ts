import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, placeDetailsCache } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

// Mock the Node fs module: readFileSync succeeds when the path is our known fixture.
const PHOTO_BYTES = Buffer.from('FAKE_JPEG_DATA');
vi.mock('node:fs', () => {
  return {
    default: {
      readFileSync: vi.fn((path: string) => {
        if (path.includes('gpid-1')) return PHOTO_BYTES;
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }),
      existsSync: vi.fn((path: string) => path.includes('gpid-1')),
    },
    readFileSync: vi.fn((path: string) => {
      if (path.includes('gpid-1')) return PHOTO_BYTES;
      const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw err;
    }),
    existsSync: vi.fn((path: string) => path.includes('gpid-1')),
  };
});
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

import { GET } from '@/app/api/photos/[placeId]/[variant]/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-05',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'place-1', tripId: 'trip-1', dayDate: null, googlePlaceId: 'gpid-1',
    name: 'Tower', address: null, lat: null, lng: null, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(placeDetailsCache).values({
    googlePlaceId: 'gpid-1',
    name: 'Tower',
    address: null,
    lat: null,
    lng: null,
    categoryGuess: 'sightseeing',
    photoRef: 'R',
    photoLocalPath: 'place-photos/gpid-1/card.webp',
    rawJson: '{}',
    fetchedAt: TS,
  }).run();
}

function ctx(placeId: string, variant: string) {
  return { params: Promise.resolve({ placeId, variant }) };
}

describe('GET /api/photos/[placeId]/[variant]', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('streams the photo bytes for a known place with a cached photo', async () => {
    const res = await GET(
      new Request('http://x/api/photos/place-1/card'),
      ctx('place-1', 'card'),
    );
    expect(res.status).toBe(200);
    const buf = await res.arrayBuffer();
    expect(Buffer.from(buf)).toEqual(PHOTO_BYTES);
    expect(res.headers.get('content-type')).toMatch(/image/);
  });

  it('returns 404 for an unknown place id', async () => {
    const res = await GET(
      new Request('http://x/api/photos/unknown/card'),
      ctx('unknown', 'card'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 for a place with no googlePlaceId', async () => {
    testHandle.db.insert(places).values({
      id: 'no-gid', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
      name: 'Drop Pin', address: null, lat: 35, lng: 139, category: 'other',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 1, createdAt: TS, updatedAt: TS,
    }).run();
    const res = await GET(
      new Request('http://x/api/photos/no-gid/card'),
      ctx('no-gid', 'card'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when the cache row has no photoLocalPath', async () => {
    testHandle.db.insert(places).values({
      id: 'no-photo', tripId: 'trip-1', dayDate: null, googlePlaceId: 'gpid-2',
      name: 'Bare', address: null, lat: null, lng: null, category: 'other',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 2, createdAt: TS, updatedAt: TS,
    }).run();
    testHandle.db.insert(placeDetailsCache).values({
      googlePlaceId: 'gpid-2', name: 'Bare', address: null, lat: null, lng: null,
      categoryGuess: 'other', photoRef: null, photoLocalPath: null,
      rawJson: '{}', fetchedAt: TS,
    }).run();
    const res = await GET(
      new Request('http://x/api/photos/no-photo/card'),
      ctx('no-photo', 'card'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 (not outside UPLOADS_DIR) when photoLocalPath contains path traversal', async () => {
    // Seed a cache row with a traversal path pointing outside UPLOADS_DIR.
    testHandle.db.insert(places).values({
      id: 'trav-place', tripId: 'trip-1', dayDate: null, googlePlaceId: 'gpid-trav',
      name: 'Traversal', address: null, lat: null, lng: null, category: 'other',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 3, createdAt: TS, updatedAt: TS,
    }).run();
    testHandle.db.insert(placeDetailsCache).values({
      googlePlaceId: 'gpid-trav', name: 'Traversal', address: null, lat: null, lng: null,
      categoryGuess: 'other', photoRef: null, photoLocalPath: '../../etc/passwd',
      rawJson: '{}', fetchedAt: TS,
    }).run();
    const res = await GET(
      new Request('http://x/api/photos/trav-place/card'),
      ctx('trav-place', 'card'),
    );
    // Must be 404 — must NOT attempt to read outside UPLOADS_DIR.
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('not_found');
  });

  it('returns 404 for an invalid variant', async () => {
    const res = await GET(
      new Request('http://x/api/photos/place-1/original'),
      ctx('place-1', 'original'),
    );
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('not_found');
  });

  it('accepts all valid variants (thumb, card, full)', async () => {
    for (const variant of ['thumb', 'card', 'full']) {
      const res = await GET(
        new Request(`http://x/api/photos/place-1/${variant}`),
        ctx('place-1', variant),
      );
      // All valid variants resolve to the same single image in 1B.
      expect(res.status).toBe(200);
    }
  });
});
