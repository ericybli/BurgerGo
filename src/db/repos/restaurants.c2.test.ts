/**
 * C2.1 + C2.2: tests for new repo exports added in Plan 2
 *  - listRestaurants (alias for listByTrip)
 *  - scheduleRestaurantToDay (creates a linked 'other' place)
 *  - unscheduleRestaurant (deletes the linked place and clears the link)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import {
  addRestaurant,
  getRestaurant,
  listRestaurants,
  scheduleRestaurantToDay,
  unscheduleRestaurant,
} from '@/src/db/repos/restaurants';
import { getPlace } from '@/src/db/repos/places';
import { eq } from 'drizzle-orm';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seedTrip(db: TestDb['db']) {
  db.insert(trips).values({
    id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('C2.1: listRestaurants', () => {
  let h: TestDb;
  beforeEach(() => {
    vi.restoreAllMocks();
    h = makeTestDb();
    seedTrip(h.db);
  });

  it('returns restaurants for a trip newest-first', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const a = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const b = addRestaurant(h.db, { tripId: 't1', name: 'B', status: 'been' });
    const ids = listRestaurants(h.db, 't1').map((x) => x.id);
    expect(ids).toEqual([b.id, a.id]);
  });

  it('scopes to the given trip', () => {
    h.db.insert(trips).values({
      id: 't2', name: 'Kyoto', startDate: '2026-07-01', endDate: '2026-07-02',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    addRestaurant(h.db, { tripId: 't2', name: 'B', status: 'want-to-try' });
    expect(listRestaurants(h.db, 't1').map((x) => x.name)).toEqual(['A']);
  });
});

describe('C2.2: scheduleRestaurantToDay / unscheduleRestaurant', () => {
  let h: TestDb;
  beforeEach(() => {
    vi.restoreAllMocks();
    h = makeTestDb();
    seedTrip(h.db);
  });

  it('scheduleRestaurantToDay creates an "other" place, copies name/notes, links it', () => {
    const r = addRestaurant(h.db, { tripId: 't1', name: 'Ichiran', status: 'want-to-try', notes: 'Tonkotsu' });
    const { restaurant, place } = scheduleRestaurantToDay(h.db, r.id, '2026-06-06');
    expect(place.tripId).toBe('t1');
    expect(place.dayDate).toBe('2026-06-06');
    expect(place.category).toBe('other');
    expect(place.name).toBe('Ichiran');
    expect(place.notes).toBe('Tonkotsu');
    expect(restaurant.linkedPlaceId).toBe(place.id);
    expect(getPlace(h.db, place.id)?.name).toBe('Ichiran');
  });

  it('scheduling a second time re-points the link to a new place (removes the old one)', () => {
    const r = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'want-to-try' });
    const first = scheduleRestaurantToDay(h.db, r.id, '2026-06-06');
    const second = scheduleRestaurantToDay(h.db, r.id, '2026-06-07');
    expect(second.place.id).not.toBe(first.place.id);
    expect(second.restaurant.linkedPlaceId).toBe(second.place.id);
    // the first place was the link target; re-scheduling removes it
    expect(getPlace(h.db, first.place.id)).toBeUndefined();
  });

  it('scheduleRestaurantToDay throws for an unknown restaurant', () => {
    expect(() => scheduleRestaurantToDay(h.db, 'nope', '2026-06-06')).toThrow();
  });

  it('unscheduleRestaurant deletes the linked place and clears the link', () => {
    const r = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'been' });
    const { place } = scheduleRestaurantToDay(h.db, r.id, '2026-06-06');
    const after = unscheduleRestaurant(h.db, r.id);
    expect(after?.linkedPlaceId).toBeNull();
    expect(getPlace(h.db, place.id)).toBeUndefined();
  });

  it('unscheduleRestaurant is a no-op (returns row) when nothing is linked', () => {
    const r = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'been' });
    expect(unscheduleRestaurant(h.db, r.id)?.linkedPlaceId).toBeNull();
  });

  it('linkedPlaceId is set NULL when the linked place is deleted (FK onDelete set null)', () => {
    h.db.insert(places).values({
      id: 'p1', tripId: 't1', dayDate: null, googlePlaceId: null, name: 'Place',
      address: null, lat: null, lng: null, category: 'other', scheduledTime: null,
      durationMin: null, cost: null, notes: null, orderIndex: 0, createdAt: TS, updatedAt: TS,
    }).run();
    const r = addRestaurant(h.db, { tripId: 't1', name: 'A', status: 'been', linkedPlaceId: 'p1' });
    h.db.delete(places).where(eq(places.id, 'p1')).run();
    expect(getRestaurant(h.db, r.id)?.linkedPlaceId).toBeNull();
  });
});
