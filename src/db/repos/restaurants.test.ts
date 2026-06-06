import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import { addPlace, deletePlace } from '@/src/db/repos/places';
import {
  addRestaurant,
  getRestaurant,
  listByTrip,
  listByStatus,
  updateRestaurant,
  deleteRestaurant,
  scheduleToDay,
  unschedule,
} from '@/src/db/repos/restaurants';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  return { db, tripId: trip.id };
}

describe('restaurants repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addRestaurant inserts with defaults and generated id/timestamps', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, { tripId, name: 'Sukiyabashi Jiro' });
    expect(r.id).toMatch(/[0-9a-f-]{36}/);
    expect(r.name).toBe('Sukiyabashi Jiro');
    expect(r.status).toBe('want-to-try'); // default
    expect(r.cuisine).toBeNull();
    expect(r.rating).toBeNull();
    expect(r.priceLevel).toBeNull();
    expect(r.notes).toBeNull();
    expect(r.linkedPlaceId).toBeNull();
    expect(r.createdAt).toEqual(NOW);
    expect(r.updatedAt).toEqual(NOW);
    expect(getRestaurant(db, r.id)?.name).toBe('Sukiyabashi Jiro');
  });

  it('addRestaurant honors provided optional fields and status', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, {
      tripId,
      name: 'Ramen Place',
      cuisine: 'Japanese',
      rating: 5,
      status: 'been',
      priceLevel: 2,
      notes: 'amazing tonkotsu',
    });
    expect(r.cuisine).toBe('Japanese');
    expect(r.rating).toBe(5);
    expect(r.status).toBe('been');
    expect(r.priceLevel).toBe(2);
    expect(r.notes).toBe('amazing tonkotsu');
  });

  it('listByTrip returns all rows newest-first (by createdAt desc, id tiebreak)', () => {
    const { db, tripId } = setup();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const a = addRestaurant(db, { tripId, name: 'A' });
    vi.setSystemTime(new Date('2026-06-08T13:00:00Z'));
    const b = addRestaurant(db, { tripId, name: 'B' });
    const ids = listByTrip(db, tripId).map((r) => r.id);
    expect(ids[0]).toBe(b.id);
    expect(ids[1]).toBe(a.id);
  });

  it('listByStatus filters by status', () => {
    const { db, tripId } = setup();
    addRestaurant(db, { tripId, name: 'Want', status: 'want-to-try' });
    addRestaurant(db, { tripId, name: 'Been', status: 'been' });
    expect(listByStatus(db, tripId, 'been').map((r) => r.name)).toEqual(['Been']);
    expect(listByStatus(db, tripId, 'want-to-try').map((r) => r.name)).toEqual([
      'Want',
    ]);
  });

  it('updateRestaurant patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, { tripId, name: 'Old' });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateRestaurant(db, r.id, { name: 'New', rating: 4 });
    expect(updated?.name).toBe('New');
    expect(updated?.rating).toBe(4);
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
  });

  it('updateRestaurant returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateRestaurant(db, 'nope', { name: 'X' })).toBeUndefined();
  });

  it('deleteRestaurant removes the row', () => {
    const { db, tripId } = setup();
    const r = addRestaurant(db, { tripId, name: 'Gone' });
    deleteRestaurant(db, r.id);
    expect(getRestaurant(db, r.id)).toBeUndefined();
  });

  it('scheduleToDay links a place; unschedule clears it', () => {
    const { db, tripId } = setup();
    const place = addPlace(db, {
      tripId,
      name: 'Jiro (scheduled)',
      category: 'other',
      dayDate: '2026-06-02',
    });
    const r = addRestaurant(db, { tripId, name: 'Jiro' });

    const linked = scheduleToDay(db, r.id, place.id);
    expect(linked?.linkedPlaceId).toBe(place.id);
    expect(getRestaurant(db, r.id)?.linkedPlaceId).toBe(place.id);

    const cleared = unschedule(db, r.id);
    expect(cleared?.linkedPlaceId).toBeNull();
  });

  it('deleting the linked place sets linked_place_id NULL (FK set null)', () => {
    const { db, tripId } = setup();
    const place = addPlace(db, {
      tripId,
      name: 'P',
      category: 'other',
      dayDate: '2026-06-02',
    });
    const r = addRestaurant(db, { tripId, name: 'R' });
    scheduleToDay(db, r.id, place.id);

    // Delete the place directly via the places repo path:
    deletePlace(db, place.id);

    expect(getRestaurant(db, r.id)?.linkedPlaceId).toBeNull();
  });
});
