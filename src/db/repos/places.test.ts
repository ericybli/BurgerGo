import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import {
  listByDay,
  listSaved,
  listAllForTrip,
  addPlace,
  updatePlace,
  deletePlace,
  getPlace,
  reorderDay,
  promoteToDay,
  moveToSaved,
} from '@/src/db/repos/places';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date(1_700_000_000_000);

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

describe('places repo — addPlace', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
  });

  it('inserts into the Saved bucket with orderIndex 0 when empty', () => {
    const row = addPlace(db, {
      tripId: 'trip-1',
      dayDate: null,
      name: 'Museum',
      category: 'sightseeing',
    });
    expect(row.id).toMatch(/[0-9a-f-]{36}/);
    expect(row.dayDate).toBeNull();
    expect(row.orderIndex).toBe(0);
    expect(row.googlePlaceId).toBeNull();
    expect(row.lat).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(listSaved(db, 'trip-1').map((p) => p.id)).toEqual([row.id]);
  });

  it('appends to a day at max(orderIndex)+1', () => {
    seedPlace(db, { id: 'd1-a', dayDate: '2026-06-05', orderIndex: 0 });
    seedPlace(db, { id: 'd1-b', dayDate: '2026-06-05', orderIndex: 1 });
    const row = addPlace(db, {
      tripId: 'trip-1',
      dayDate: '2026-06-05',
      name: 'Park',
      category: 'activity',
    });
    expect(row.orderIndex).toBe(2);
    expect(listByDay(db, 'trip-1', '2026-06-05').map((p) => p.id)).toEqual([
      'd1-a', 'd1-b', row.id,
    ]);
  });

  it('persists all optional fields when provided', () => {
    const row = addPlace(db, {
      tripId: 'trip-1',
      dayDate: '2026-06-05',
      googlePlaceId: 'gpid-1',
      name: 'Tower',
      address: '1-2-3',
      lat: 35.0,
      lng: 139.0,
      category: 'sightseeing',
      scheduledTime: '09:30',
      durationMin: 90,
      cost: 1500,
      notes: 'bring camera',
    });
    expect(row.googlePlaceId).toBe('gpid-1');
    expect(row.lat).toBeCloseTo(35.0, 4);
    expect(row.scheduledTime).toBe('09:30');
    expect(row.durationMin).toBe(90);
    expect(row.cost).toBe(1500);
    expect(row.notes).toBe('bring camera');
  });
});

describe('places repo — updatePlace', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedPlace(db, { id: 'p1', dayDate: '2026-06-05', name: 'Old', orderIndex: 0 });
  });

  it('patches provided fields and bumps updatedAt, returns the row', () => {
    const before = listByDay(db, 'trip-1', '2026-06-05')[0]!;
    const row = updatePlace(db, 'p1', {
      name: 'New',
      scheduledTime: '10:00',
      cost: 500,
    });
    expect(row?.name).toBe('New');
    expect(row?.scheduledTime).toBe('10:00');
    expect(row?.cost).toBe(500);
    // Untouched fields preserved.
    expect(row?.dayDate).toBe('2026-06-05');
    expect(row?.orderIndex).toBe(0);
    expect(row!.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it('can clear a nullable field by passing null', () => {
    updatePlace(db, 'p1', { scheduledTime: '09:00' });
    const row = updatePlace(db, 'p1', { scheduledTime: null });
    expect(row?.scheduledTime).toBeNull();
  });

  it('returns undefined for an unknown id', () => {
    expect(updatePlace(db, 'nope', { name: 'X' })).toBeUndefined();
  });
});

describe('places repo — deletePlace', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedPlace(db, { id: 'p1', dayDate: '2026-06-05', orderIndex: 0 });
  });

  it('removes the row', () => {
    deletePlace(db, 'p1');
    expect(listByDay(db, 'trip-1', '2026-06-05')).toEqual([]);
  });
});

describe('places repo — getPlace', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedPlace(db, { id: 'p1', dayDate: '2026-06-05', orderIndex: 0 });
  });

  it('returns the row when found', () => {
    expect(getPlace(db, 'p1')?.id).toBe('p1');
  });

  it('returns undefined when not found', () => {
    expect(getPlace(db, 'nope')).toBeUndefined();
  });
});

describe('places repo — reorderDay', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedPlace(db, { id: 'a', dayDate: '2026-06-05', orderIndex: 0 });
    seedPlace(db, { id: 'b', dayDate: '2026-06-05', orderIndex: 1 });
    seedPlace(db, { id: 'c', dayDate: '2026-06-05', orderIndex: 2 });
  });

  it('rewrites orderIndex to match the given id order (0-based contiguous)', () => {
    reorderDay(db, 'trip-1', '2026-06-05', ['c', 'a', 'b']);
    const rows = listByDay(db, 'trip-1', '2026-06-05');
    expect(rows.map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(rows.map((p) => p.orderIndex)).toEqual([0, 1, 2]);
  });

  it('ignores ids that are not in the target day', () => {
    seedTrip(db, 'trip-2');
    seedPlace(db, { id: 'z', tripId: 'trip-2', dayDate: '2026-06-05', orderIndex: 0 });
    reorderDay(db, 'trip-1', '2026-06-05', ['b', 'z', 'a', 'c']);
    const rows = listByDay(db, 'trip-1', '2026-06-05');
    // 'z' is skipped; remaining are renumbered contiguously by their position.
    expect(rows.map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(rows.map((p) => p.orderIndex)).toEqual([0, 1, 2]);
  });
});

describe('places repo — promoteToDay', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedPlace(db, { id: 'd-0', dayDate: '2026-06-05', orderIndex: 0 });
    seedPlace(db, { id: 's-0', dayDate: null, orderIndex: 0 });
    seedPlace(db, { id: 's-1', dayDate: null, orderIndex: 1 });
  });

  it('sets day_date and appends at max(day order)+1', () => {
    const row = promoteToDay(db, 's-1', '2026-06-05');
    expect(row?.dayDate).toBe('2026-06-05');
    expect(row?.orderIndex).toBe(1); // existing d-0 is 0, so next is 1
    expect(listByDay(db, 'trip-1', '2026-06-05').map((p) => p.id)).toEqual([
      'd-0', 's-1',
    ]);
  });

  it('promotes to an empty day at orderIndex 0', () => {
    const row = promoteToDay(db, 's-0', '2026-06-06');
    expect(row?.dayDate).toBe('2026-06-06');
    expect(row?.orderIndex).toBe(0);
  });

  it('returns undefined for an unknown id', () => {
    expect(promoteToDay(db, 'nope', '2026-06-05')).toBeUndefined();
  });
});

describe('places repo — aiSummary patch', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
  });

  it('updatePlace persists aiSummary', () => {
    const p = addPlace(db, { tripId: 'trip-1', name: 'X', category: 'other', dayDate: '2026-06-02' });
    const updated = updatePlace(db, p.id, { aiSummary: 'A lovely spot.' });
    expect(updated?.aiSummary).toBe('A lovely spot.');
  });
});

describe('places repo — moveToSaved', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedPlace(db, { id: 'd-0', dayDate: '2026-06-05', orderIndex: 0 });
    seedPlace(db, { id: 's-0', dayDate: null, orderIndex: 0 });
  });

  it('nulls day_date and appends at the end of the Saved bucket', () => {
    const row = moveToSaved(db, 'd-0');
    expect(row?.dayDate).toBeNull();
    expect(row?.orderIndex).toBe(1); // s-0 occupies 0
    expect(listSaved(db, 'trip-1').map((p) => p.id)).toEqual(['s-0', 'd-0']);
  });

  it('returns undefined for an unknown id', () => {
    expect(moveToSaved(db, 'nope')).toBeUndefined();
  });
});
