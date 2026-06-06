import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import {
  getCachedLeg,
  upsertLeg,
  legsForDay,
} from '@/src/db/repos/legs';

// Deterministic clock so computedAt is assertable.
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date(1_700_000_000_000);

type Db = ReturnType<typeof makeTestDb>['db'];

function seed(db: Db) {
  db.insert(trips).values({
    id: 'trip-1',
    name: 'Tokyo',
    startDate: '2026-06-05',
    endDate: '2026-06-07',
    coverPhoto: null,
    createdAt: TS,
    updatedAt: TS,
  }).run();
  db.insert(places).values([
    {
      id: 'p-a', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
      name: 'A', address: null, lat: 35.0, lng: 139.0, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 0, createdAt: TS, updatedAt: TS,
    },
    {
      id: 'p-b', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
      name: 'B', address: null, lat: 35.1, lng: 139.1, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 1, createdAt: TS, updatedAt: TS,
    },
  ]).run();
}

describe('legs repo cache primitives', () => {
  let db: Db;
  let sqlite: ReturnType<typeof makeTestDb>['sqlite'];

  beforeEach(() => {
    const h = makeTestDb();
    db = h.db;
    sqlite = h.sqlite;
    seed(db);
  });

  it('getCachedLeg returns undefined on a miss', () => {
    expect(getCachedLeg(db, 'p-a', 'p-b', 'walk')).toBeUndefined();
  });

  it('upsertLeg inserts a leg and getCachedLeg reads it back', () => {
    const leg = upsertLeg(db, {
      tripId: 'trip-1',
      fromPlaceId: 'p-a',
      toPlaceId: 'p-b',
      mode: 'walk',
      durationSeconds: 600,
      distanceMeters: 800,
      polyline: 'abc123',
    });
    expect(leg.id).toBeTruthy();
    expect(leg.computedAt).toEqual(TS);
    expect(leg.polyline).toBe('abc123');

    const got = getCachedLeg(db, 'p-a', 'p-b', 'walk');
    expect(got).toBeDefined();
    expect(got!.durationSeconds).toBe(600);
    expect(got!.distanceMeters).toBe(800);
    expect(got!.polyline).toBe('abc123');
    expect(got!.mode).toBe('walk');
  });

  it('upsertLeg refreshes an existing (from,to,mode) row in place', () => {
    upsertLeg(db, {
      tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'drive',
      durationSeconds: 300, distanceMeters: 4000, polyline: 'P1',
    });
    upsertLeg(db, {
      tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'drive',
      durationSeconds: 360, distanceMeters: 4200, polyline: 'P2',
    });

    const got = getCachedLeg(db, 'p-a', 'p-b', 'drive');
    expect(got!.durationSeconds).toBe(360);
    expect(got!.distanceMeters).toBe(4200);
    expect(got!.polyline).toBe('P2');

    const { c } = sqlite.prepare('SELECT count(*) AS c FROM travel_legs').get() as { c: number };
    expect(c).toBe(1);
  });

  it('upsertLeg accepts null polyline (no Directions result yet)', () => {
    const leg = upsertLeg(db, {
      tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'transit',
      durationSeconds: 240, distanceMeters: 900, polyline: null,
    });
    expect(leg.polyline).toBeNull();
  });

  it('keeps modes distinct for the same pair (composite unique key)', () => {
    upsertLeg(db, {
      tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk',
      durationSeconds: 600, distanceMeters: 800, polyline: 'W',
    });
    upsertLeg(db, {
      tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'transit',
      durationSeconds: 240, distanceMeters: 900, polyline: 'T',
    });
    expect(getCachedLeg(db, 'p-a', 'p-b', 'walk')!.durationSeconds).toBe(600);
    expect(getCachedLeg(db, 'p-a', 'p-b', 'transit')!.durationSeconds).toBe(240);
    const { c } = sqlite.prepare('SELECT count(*) AS c FROM travel_legs').get() as { c: number };
    expect(c).toBe(2);
  });
});

describe('legs repo — legsForDay', () => {
  let db: Db;
  let sqlite: ReturnType<typeof makeTestDb>['sqlite'];

  beforeEach(() => {
    const h = makeTestDb();
    db = h.db;
    sqlite = h.sqlite;
    seed(db);
    // Add a third place so we have three consecutive stops.
    db.insert(places).values({
      id: 'p-c', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
      name: 'C', address: null, lat: 35.2, lng: 139.2, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 2, createdAt: TS, updatedAt: TS,
    }).run();
  });

  it('returns one entry per consecutive pair in itinerary order', () => {
    upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk', durationSeconds: 600, distanceMeters: 750, polyline: 'W1' });
    upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-b', toPlaceId: 'p-c', mode: 'walk', durationSeconds: 420, distanceMeters: 500, polyline: 'W2' });
    const legs = legsForDay(db, 'trip-1', '2026-06-05', 'walk');
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({ fromPlaceId: 'p-a', toPlaceId: 'p-b', durationSeconds: 600 });
    expect(legs[1]).toMatchObject({ fromPlaceId: 'p-b', toPlaceId: 'p-c', durationSeconds: 420 });
  });

  it('yields null for a not-yet-computed leg', () => {
    upsertLeg(db, { tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk', durationSeconds: 600, distanceMeters: 750, polyline: null });
    const legs = legsForDay(db, 'trip-1', '2026-06-05', 'walk');
    expect(legs[0]).toMatchObject({ fromPlaceId: 'p-a', toPlaceId: 'p-b' });
    expect(legs[1]).toBeNull(); // p-b→p-c not yet computed
  });

  it('returns [] for a day with fewer than two places', () => {
    expect(legsForDay(db, 'trip-1', '2026-06-07', 'walk')).toEqual([]);
  });
});
