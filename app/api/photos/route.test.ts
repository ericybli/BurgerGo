// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

// Mock the disk-writing step; assert the pipeline is invoked with the right args.
const processPhoto = vi.fn(async (a: { tripId: string; photoId: string }) => ({
  path: `${a.tripId}/${a.photoId}`, width: 1600, height: 800,
}));
vi.mock('@/src/lib/photos/pipeline', async (orig) => {
  const actual = await orig<typeof import('@/src/lib/photos/pipeline')>();
  return { ...actual, processPhoto: (...args: unknown[]) => processPhoto(...(args as [{ tripId: string; photoId: string }])) };
});

import { POST } from '@/app/api/photos/route';
import { listByOwner } from '@/src/db/repos/photos';

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
}

function uploadReq(fields: { image?: Blob; tripId?: string; ownerType?: string; ownerId?: string }) {
  const fd = new FormData();
  if (fields.image) fd.set('image', fields.image, 'photo.jpg');
  if (fields.tripId !== undefined) fd.set('tripId', fields.tripId);
  if (fields.ownerType !== undefined) fd.set('ownerType', fields.ownerType);
  if (fields.ownerId !== undefined) fd.set('ownerId', fields.ownerId);
  return new Request('http://x/api/photos', { method: 'POST', body: fd });
}

function imageBlob(bytes = 1000) {
  return new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
}

describe('POST /api/photos', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    processPhoto.mockClear();
  });

  it('uploads an image, runs the pipeline, inserts a row, and returns the DTO', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(201);
    const body = await res.json() as { photo: { id: string; tripId: string; ownerId: string; path: string; width: number; height: number } };
    expect(body.photo.tripId).toBe('trip-1');
    expect(body.photo.ownerId).toBe('place-1');
    expect(body.photo.path).toBe(`trip-1/${body.photo.id}`);
    expect(body.photo.width).toBe(1600);
    expect(body.photo.height).toBe(800);

    expect(processPhoto).toHaveBeenCalledWith(expect.objectContaining({
      uploadsDir: '/uploads', tripId: 'trip-1', photoId: body.photo.id,
    }));
    expect(listByOwner(testHandle.db, 'place', 'place-1')).toHaveLength(1);
  });

  it('rejects a non-image file with 415', async () => {
    const pdf = new Blob([new Uint8Array(100)], { type: 'application/pdf' });
    const res = await POST(uploadReq({ image: pdf, tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(415);
    expect(processPhoto).not.toHaveBeenCalled();
    expect(listByOwner(testHandle.db, 'place', 'place-1')).toHaveLength(0);
  });

  it('rejects an oversized file with 413', async () => {
    const big = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'image/jpeg' });
    const res = await POST(uploadReq({ image: big, tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(413);
    expect(processPhoto).not.toHaveBeenCalled();
  });

  it('returns 400 when the image field is missing', async () => {
    const res = await POST(uploadReq({ tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid ownerType', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'bogus', ownerId: 'place-1' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the trip does not exist', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'ghost', ownerType: 'place', ownerId: 'place-1' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the place owner does not exist or belongs to another trip', async () => {
    const res = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('enforces the per-place max photo count', async () => {
    for (let i = 0; i < 12; i++) {
      const r = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
      expect(r.status).toBe(201);
    }
    const over = await POST(uploadReq({ image: imageBlob(), tripId: 'trip-1', ownerType: 'place', ownerId: 'place-1' }));
    expect(over.status).toBe(409);
  });
});
