import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import {
  addPlaceAction,
  updatePlaceAction,
} from '@/app/_actions/places';
import { getPlace } from '@/src/db/repos/places';
import { upsertLeg, getCachedLeg } from '@/src/db/repos/legs';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

function seedTwoPlaces(db: ReturnType<typeof makeTestDb>['db']) {
  for (const [id, order] of [['a', 0], ['b', 1]] as const) {
    db.insert(places).values({
      id, tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
      name: id.toUpperCase(), address: null, lat: 35, lng: 139,
      category: 'sightseeing', scheduledTime: null, durationMin: null,
      cost: null, notes: null, orderIndex: order, createdAt: TS, updatedAt: TS,
    }).run();
  }
}

describe('addPlaceAction', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
  });

  it('adds a place to a day and revalidates the trip plan path', async () => {
    const place = await addPlaceAction({
      tripId: 'trip-1',
      dayDate: '2026-06-05',
      name: 'Castle',
      category: 'sightseeing',
      lat: 34.9,
      lng: 135.7,
    });
    expect(place.name).toBe('Castle');
    expect(place.orderIndex).toBe(0);
    expect(getPlace(testHandle.db, place.id)?.name).toBe('Castle');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
  });

  it('adds to the Saved bucket when dayDate is omitted', async () => {
    const place = await addPlaceAction({
      tripId: 'trip-1',
      name: 'Wishlist Spot',
      category: 'other',
    });
    expect(place.dayDate).toBeNull();
  });

  it('rejects an empty name', async () => {
    await expect(
      addPlaceAction({ tripId: 'trip-1', name: '', category: 'other' }),
    ).rejects.toThrow();
  });

  it('rejects an unknown category', async () => {
    await expect(
      addPlaceAction({
        tripId: 'trip-1',
        name: 'X',
        // @ts-expect-error invalid category for the test
        category: 'bogus',
      }),
    ).rejects.toThrow();
  });
});

describe('updatePlaceAction', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    seedTwoPlaces(testHandle.db);
    revalidatePath.mockClear();
  });

  it('patches fields and revalidates without touching legs when coords unchanged', async () => {
    upsertLeg(testHandle.db, {
      tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
      durationSeconds: 600, distanceMeters: 750, polyline: 'P',
    });
    const row = await updatePlaceAction('a', { name: 'Renamed', cost: 100 });
    expect(row.name).toBe('Renamed');
    // No lat/lng in patch ⇒ leg cache preserved.
    expect(getCachedLeg(testHandle.db, 'a', 'b', 'walk')?.durationSeconds).toBe(600);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
  });

  it('invalidates legs touching the place when lat/lng change', async () => {
    upsertLeg(testHandle.db, {
      tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
      durationSeconds: 600, distanceMeters: 750, polyline: 'P',
    });
    await updatePlaceAction('a', { lat: 34.0, lng: 135.0 });
    expect(getCachedLeg(testHandle.db, 'a', 'b', 'walk')).toBeUndefined();
  });

  it('throws when the place id is unknown', async () => {
    await expect(updatePlaceAction('nope', { name: 'X' })).rejects.toThrow();
  });
});
