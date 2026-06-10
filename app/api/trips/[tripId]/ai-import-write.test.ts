// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import { listAllForTrip } from '@/src/db/repos/places';
import { listByTrip as listRestaurants } from '@/src/db/repos/restaurants';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'K', UPLOADS_DIR: '/tmp' } }));

// Same module mocks as app/_actions/aiImport.test.ts — no real OpenAI/Google calls.
const extractPlaces = vi.fn();
vi.mock('@/src/lib/openai/server', () => ({ extractPlaces: (...a: unknown[]) => extractPlaces(...a) }));
const resolvePlaceByName = vi.fn();
vi.mock('@/src/lib/google/resolvePlace', () => ({ resolvePlaceByName: (...a: unknown[]) => resolvePlaceByName(...a) }));

import { POST as EXTRACT } from '@/app/api/trips/[tripId]/ai-import/extract/route';
import { POST as CREATE } from '@/app/api/trips/[tripId]/ai-import/create/route';

const TS = new Date('2026-06-09T12:00:00.000Z');
type Db = ReturnType<typeof makeTestDb>['db'];

function req(body?: unknown, key?: string) {
  return new Request('http://x', {
    method: 'POST',
    headers: key ? { 'x-api-key': key } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const P = <T extends object>(o: T) => ({ params: Promise.resolve(o) });

function seedTrip(db: Db) {
  db.insert(trips).values({
    id: 't1', name: 'Hawaii 2026', startDate: '2026-09-04', endDate: '2026-09-12',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

function ai(over: Record<string, unknown> = {}) {
  return { type: 'place', name: 'Senso-ji', area: 'Tokyo', address: '', cuisine: '', category: 'sightseeing', notes: '', ...over };
}

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  seedTrip(testHandle.db);
  extractPlaces.mockReset();
  resolvePlaceByName.mockReset();
});
afterEach(() => {
  delete process.env.BURGERGO_API_KEY;
});

describe('ai-import extract API', () => {
  it('extracts + resolves and returns the preview items', async () => {
    extractPlaces.mockResolvedValue([
      ai({ type: 'restaurant', name: 'Ichiran', cuisine: 'Ramen' }),
      ai({ type: 'place', name: 'Senso-ji' }),
    ]);
    resolvePlaceByName
      .mockResolvedValueOnce({ googlePlaceId: 'g1', name: 'Ichiran Ramen', address: 'Tokyo 1', lat: 35.6, lng: 139.7, categoryGuess: 'other', photoLocalPath: null })
      .mockResolvedValueOnce({ googlePlaceId: 'g2', name: 'Sensō-ji', address: 'Asakusa', lat: 35.71, lng: 139.79, categoryGuess: 'sightseeing', photoLocalPath: null });

    const res = await EXTRACT(req({ images: [], text: 'two spots' }), P({ tripId: 't1' }));
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as { items: Array<Record<string, unknown>> };
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'restaurant', name: 'Ichiran Ramen', googlePlaceId: 'g1', lat: 35.6, resolved: true });
    expect(items[1]).toMatchObject({ type: 'place', name: 'Sensō-ji', googlePlaceId: 'g2', resolved: true });
    expect(extractPlaces).toHaveBeenCalledWith(expect.objectContaining({ tripContext: expect.stringContaining('Hawaii 2026') }));
  });

  it('unknown trip → 404; invalid body → 400', async () => {
    extractPlaces.mockResolvedValue([]);
    const missing = await EXTRACT(req({ images: [], text: 'x' }), P({ tripId: 'nope' }));
    expect(missing.status).toBe(404);
    const bad = await EXTRACT(req({ images: 'not-an-array', text: 'x' }), P({ tripId: 't1' }));
    expect(bad.status).toBe(400);
  });
});

describe('ai-import create API', () => {
  it('creates restaurants in Eats and places in the Saved bucket, returning counts', async () => {
    const res = await CREATE(
      req({
        items: [
          { type: 'restaurant', name: 'Ichiran', cuisine: 'Ramen', address: 'Tokyo', lat: 35.6, lng: 139.7, googlePlaceId: 'g1' },
          { type: 'place', name: 'Senso-ji', category: 'sightseeing', lat: 35.71, lng: 139.79, googlePlaceId: 'g2' },
        ],
      }),
      P({ tripId: 't1' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ restaurants: 1, places: 1 });

    const restaurants = listRestaurants(testHandle.db, 't1');
    expect(restaurants).toHaveLength(1);
    expect(restaurants[0]).toMatchObject({ name: 'Ichiran', status: 'want-to-try', googlePlaceId: 'g1' });

    const places = listAllForTrip(testHandle.db, 't1');
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: 'Senso-ji', dayDate: null, category: 'sightseeing', googlePlaceId: 'g2' });
  });

  it('unknown trip → 404; missing items / invalid item → 400 and creates nothing', async () => {
    const missing = await CREATE(req({ items: [{ type: 'place', name: 'X' }] }), P({ tripId: 'nope' }));
    expect(missing.status).toBe(404);

    expect((await CREATE(req({}), P({ tripId: 't1' }))).status).toBe(400);
    const bad = await CREATE(req({ items: [{ type: 'bogus', name: 'X' }] }), P({ tripId: 't1' }));
    expect(bad.status).toBe(400);
    expect(listAllForTrip(testHandle.db, 't1')).toHaveLength(0);
    expect(listRestaurants(testHandle.db, 't1')).toHaveLength(0);
  });

  it('enforces the write key when BURGERGO_API_KEY is set', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    const noKey = await CREATE(req({ items: [] }), P({ tripId: 't1' }));
    expect(noKey.status).toBe(401);
    const withKey = await CREATE(req({ items: [] }, 'secret'), P({ tripId: 't1' }));
    expect(withKey.status).toBe(200);
    expect(await withKey.json()).toEqual({ restaurants: 0, places: 0 });
  });
});
