import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import {
  getTrips,
  getTrip,
  createTrip,
  renameTrip,
  updateTripDates,
  setCover,
  deleteTrip,
} from '@/src/db/repos/trips';

// The repo reads the system clock; pin it inside the active window of the
// "Active" fixture below.
const TZ = 'UTC';
const NOW = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  // Insert in a deliberately non-sorted order to prove the repo sorts.
  db.insert(trips).values([
    {
      id: 'past-1',
      name: 'Past Trip',
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      coverPhoto: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'upcoming-late',
      name: 'Upcoming Late',
      startDate: '2026-12-01',
      endDate: '2026-12-10',
      coverPhoto: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'active-1',
      name: 'Active Trip',
      startDate: '2026-06-05',
      endDate: '2026-06-12',
      coverPhoto: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'upcoming-early',
      name: 'Upcoming Early',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
      coverPhoto: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ]).run();
}

describe('getTrips', () => {
  let db: ReturnType<typeof makeTestDb>['db'];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    db = makeTestDb().db;
    seed(db);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the active trip first, then the rest by startDate ascending', () => {
    const rows = getTrips(db, { tz: TZ });
    expect(rows.map((t) => t.id)).toEqual([
      'active-1',
      'past-1',
      'upcoming-early',
      'upcoming-late',
    ]);
  });

  it('returns an empty array when there are no trips', () => {
    const empty = makeTestDb().db;
    expect(getTrips(empty, { tz: TZ })).toEqual([]);
  });
});

describe('getTrip', () => {
  let db: ReturnType<typeof makeTestDb>['db'];
  beforeEach(() => {
    db = makeTestDb().db;
    seed(db);
  });

  it('returns the matching trip row', () => {
    const t = getTrip(db, 'active-1');
    expect(t?.name).toBe('Active Trip');
    expect(t?.startDate).toBe('2026-06-05');
  });

  it('returns undefined for an unknown id', () => {
    expect(getTrip(db, 'nope')).toBeUndefined();
  });
});

describe('createTrip', () => {
  let db: ReturnType<typeof makeTestDb>['db'];
  beforeEach(() => {
    db = makeTestDb().db;
  });

  it('inserts and returns a trip with generated id and timestamps', () => {
    const row = createTrip(db, {
      name: 'Kyoto',
      startDate: '2026-09-01',
      endDate: '2026-09-07',
    });
    expect(row.id).toMatch(/[0-9a-f-]{36}/);
    expect(row.name).toBe('Kyoto');
    expect(row.startDate).toBe('2026-09-01');
    expect(row.endDate).toBe('2026-09-07');
    expect(row.coverPhoto).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);

    // It is actually persisted.
    const fetched = getTrip(db, row.id);
    expect(fetched?.name).toBe('Kyoto');
  });

  it('allows a single-day trip (endDate === startDate)', () => {
    const row = createTrip(db, {
      name: 'Day Trip',
      startDate: '2026-09-01',
      endDate: '2026-09-01',
    });
    expect(row.endDate).toBe('2026-09-01');
  });

  it('throws when endDate is before startDate', () => {
    expect(() =>
      createTrip(db, {
        name: 'Bad',
        startDate: '2026-09-07',
        endDate: '2026-09-01',
      }),
    ).toThrow(/end date/i);
  });
});

describe('trip mutators', () => {
  let db: ReturnType<typeof makeTestDb>['db'];
  let id: string;
  beforeEach(() => {
    db = makeTestDb().db;
    id = createTrip(db, {
      name: 'Original',
      startDate: '2026-09-01',
      endDate: '2026-09-07',
    }).id;
  });

  it('renameTrip updates the name and returns the row', () => {
    const row = renameTrip(db, id, 'Renamed');
    expect(row?.name).toBe('Renamed');
    expect(getTrip(db, id)?.name).toBe('Renamed');
  });

  it('renameTrip returns undefined for unknown id', () => {
    expect(renameTrip(db, 'nope', 'X')).toBeUndefined();
  });

  it('updateTripDates changes both dates', () => {
    const row = updateTripDates(db, id, {
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    });
    expect(row?.startDate).toBe('2026-10-01');
    expect(row?.endDate).toBe('2026-10-05');
  });

  it('updateTripDates throws when endDate < startDate', () => {
    expect(() =>
      updateTripDates(db, id, {
        startDate: '2026-10-05',
        endDate: '2026-10-01',
      }),
    ).toThrow(/end date/i);
  });

  it('setCover sets and clears the cover path', () => {
    expect(setCover(db, id, 'covers/abc.webp')?.coverPhoto).toBe(
      'covers/abc.webp',
    );
    expect(setCover(db, id, null)?.coverPhoto).toBeNull();
  });

  it('deleteTrip removes the row', () => {
    deleteTrip(db, id);
    expect(getTrip(db, id)).toBeUndefined();
  });
});
