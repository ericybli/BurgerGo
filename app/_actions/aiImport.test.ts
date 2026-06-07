import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import { listAllForTrip } from '@/src/db/repos/places';
import { listByTrip as listRestaurants } from '@/src/db/repos/restaurants';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; } }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'K', UPLOADS_DIR: '/tmp' } }));

const extractPlaces = vi.fn();
vi.mock('@/src/lib/openai/server', () => ({ extractPlaces: (...a: unknown[]) => extractPlaces(...a) }));
const resolvePlaceByName = vi.fn();
vi.mock('@/src/lib/google/resolvePlace', () => ({ resolvePlaceByName: (...a: unknown[]) => resolvePlaceByName(...a) }));

import { extractImportItemsAction, createImportItemsAction } from '@/app/_actions/aiImport';

const TS = new Date('2026-06-08T12:00:00.000Z');

function ai(over: Record<string, unknown> = {}) {
  return { type: 'place', name: 'Senso-ji', area: 'Tokyo', address: '', cuisine: '', category: 'sightseeing', notes: '', ...over };
}

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  testHandle.db.insert(trips).values({
    id: 'trip-1', name: 'Hawaii 2026', startDate: '2026-09-04', endDate: '2026-09-12',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  extractPlaces.mockReset();
  resolvePlaceByName.mockReset();
  revalidatePath.mockClear();
});

describe('extractImportItemsAction', () => {
  it('extracts then resolves each item, returning coords + place id + resolved=true', async () => {
    extractPlaces.mockResolvedValue([
      ai({ type: 'restaurant', name: 'Ichiran', cuisine: 'Ramen' }),
      ai({ type: 'place', name: 'Senso-ji', category: 'sightseeing' }),
    ]);
    resolvePlaceByName
      .mockResolvedValueOnce({ googlePlaceId: 'g1', name: 'Ichiran Ramen', address: 'Tokyo 1', lat: 35.6, lng: 139.7, categoryGuess: 'other', photoLocalPath: 'gphotos/g1.webp' })
      .mockResolvedValueOnce({ googlePlaceId: 'g2', name: 'Sensō-ji', address: 'Asakusa', lat: 35.71, lng: 139.79, categoryGuess: 'sightseeing', photoLocalPath: null });

    const { items } = await extractImportItemsAction({ tripId: 'trip-1', images: [], text: 'two spots' });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: 'restaurant', name: 'Ichiran Ramen', googlePlaceId: 'g1', lat: 35.6, resolved: true });
    expect(items[1]).toMatchObject({ type: 'place', name: 'Sensō-ji', googlePlaceId: 'g2', resolved: true });
    // model passed from settings (none seeded → undefined/null), trip context built
    expect(extractPlaces).toHaveBeenCalledWith(expect.objectContaining({ tripContext: expect.stringContaining('Hawaii 2026') }));
  });

  it('keeps the AI address and marks resolved=false when Google finds nothing', async () => {
    extractPlaces.mockResolvedValue([ai({ name: 'Mystery Spot', address: '123 Somewhere St' })]);
    resolvePlaceByName.mockResolvedValue(null);
    const { items } = await extractImportItemsAction({ tripId: 'trip-1', images: [], text: 'x' });
    expect(items[0]).toMatchObject({ name: 'Mystery Spot', address: '123 Somewhere St', lat: null, lng: null, googlePlaceId: null, resolved: false });
  });

  it('returns no items when the model extracts nothing', async () => {
    extractPlaces.mockResolvedValue([]);
    expect(await extractImportItemsAction({ tripId: 'trip-1', images: [], text: 'nothing here' })).toEqual({ items: [] });
    expect(resolvePlaceByName).not.toHaveBeenCalled();
  });

  it('rejects an unknown trip', async () => {
    await expect(extractImportItemsAction({ tripId: 'nope', images: [], text: 'x' })).rejects.toThrow('Trip not found');
  });
});

describe('createImportItemsAction', () => {
  it('creates restaurants in Eats and places in the Saved bucket, returning counts', async () => {
    const res = await createImportItemsAction({
      tripId: 'trip-1',
      items: [
        { type: 'restaurant', name: 'Ichiran', cuisine: 'Ramen', address: 'Tokyo', lat: 35.6, lng: 139.7, googlePlaceId: 'g1' },
        { type: 'place', name: 'Senso-ji', category: 'sightseeing', lat: 35.71, lng: 139.79, googlePlaceId: 'g2' },
      ],
    });
    expect(res).toEqual({ restaurants: 1, places: 1 });

    const restaurants = listRestaurants(testHandle.db, 'trip-1');
    expect(restaurants).toHaveLength(1);
    expect(restaurants[0]).toMatchObject({ name: 'Ichiran', status: 'want-to-try', googlePlaceId: 'g1', lat: 35.6 });

    const places = listAllForTrip(testHandle.db, 'trip-1');
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: 'Senso-ji', dayDate: null, category: 'sightseeing', googlePlaceId: 'g2' });

    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/eats');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
  });

  it('coerces an unknown place category to "other"', async () => {
    await createImportItemsAction({ tripId: 'trip-1', items: [{ type: 'place', name: 'Thing', category: 'bogus' }] });
    expect(listAllForTrip(testHandle.db, 'trip-1')[0]!.category).toBe('other');
  });

  it('rejects an unknown trip', async () => {
    await expect(createImportItemsAction({ tripId: 'nope', items: [{ type: 'place', name: 'X' }] })).rejects.toThrow('Trip not found');
  });
});
