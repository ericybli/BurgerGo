import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import {
  listByDay,
  listSaved,
  listAllForTrip,
} from '@/src/db/repos/places';

const TS = new Date('2026-06-08T12:00:00.000Z');

type Db = ReturnType<typeof makeTestDb>['db'];

function seedTrip(db: Db, id = 'trip-1') {
  db.insert(trips)
    .values({
      id,
      name: 'Osaka',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      coverPhoto: null,
      createdAt: TS,
      updatedAt: TS,
    })
    .run();
}

function seedPlace(
  db: Db,
  over: Partial<typeof places.$inferInsert> & { id: string },
) {
  db.insert(places)
    .values({
      tripId: 'trip-1',
      dayDate: null,
      googlePlaceId: null,
      name: 'Place',
      address: null,
      lat: null,
      lng: null,
      category: 'sightseeing',
      scheduledTime: null,
      durationMin: null,
      cost: null,
      notes: null,
      orderIndex: 0,
      createdAt: TS,
      updatedAt: TS,
      ...over,
    })
    .run();
}

describe('places repo — reads', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    // Day 06-05: insert out of order to prove ordering by orderIndex.
    seedPlace(db, { id: 'd1-b', dayDate: '2026-06-05', name: 'Castle', orderIndex: 1 });
    seedPlace(db, { id: 'd1-a', dayDate: '2026-06-05', name: 'Shrine', orderIndex: 0 });
    // Day 06-06.
    seedPlace(db, { id: 'd2-a', dayDate: '2026-06-06', name: 'Market', orderIndex: 0 });
    // Saved bucket (dayDate NULL), out of order.
    seedPlace(db, { id: 's-b', dayDate: null, name: 'Aquarium', orderIndex: 1 });
    seedPlace(db, { id: 's-a', dayDate: null, name: 'Museum', orderIndex: 0 });
    // A different trip's place must never leak in.
    seedTrip(db, 'trip-2');
    seedPlace(db, { id: 'other', tripId: 'trip-2', dayDate: '2026-06-05', name: 'Nope', orderIndex: 0 });
  });

  it('listByDay returns one day, ordered by orderIndex', () => {
    const rows = listByDay(db, 'trip-1', '2026-06-05');
    expect(rows.map((p) => p.id)).toEqual(['d1-a', 'd1-b']);
    expect(rows.map((p) => p.name)).toEqual(['Shrine', 'Castle']);
  });

  it('listByDay returns [] for an empty day', () => {
    expect(listByDay(db, 'trip-1', '2026-06-07')).toEqual([]);
  });

  it('listSaved returns only NULL-day rows, ordered by orderIndex', () => {
    const rows = listSaved(db, 'trip-1');
    expect(rows.map((p) => p.id)).toEqual(['s-a', 's-b']);
  });

  it('listAllForTrip returns every place for the trip, scoped by tripId', () => {
    const rows = listAllForTrip(db, 'trip-1');
    expect(rows.map((p) => p.id).sort()).toEqual(
      ['d1-a', 'd1-b', 'd2-a', 's-a', 's-b'].sort(),
    );
    expect(rows.every((p) => p.tripId === 'trip-1')).toBe(true);
  });

  it('listAllForTrip orders by dayDate (NULLs last) then orderIndex', () => {
    const rows = listAllForTrip(db, 'trip-1');
    expect(rows.map((p) => p.id)).toEqual([
      'd1-a', 'd1-b', 'd2-a', 's-a', 's-b',
    ]);
  });
});
