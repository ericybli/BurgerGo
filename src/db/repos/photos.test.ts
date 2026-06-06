import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip, deleteTrip } from '@/src/db/repos/trips';
import { addPlace } from '@/src/db/repos/places';
import {
  addPhoto,
  getPhoto,
  listByOwner,
  firstForOwner,
  deletePhoto,
  reorderOwner,
} from '@/src/db/repos/photos';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db, sqlite } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  const place = addPlace(db, {
    tripId: trip.id,
    name: 'Tower',
    category: 'sightseeing',
    dayDate: '2026-06-02',
  });
  return { db, sqlite, tripId: trip.id, placeId: place.id };
}

describe('photos repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addPhoto stores the §5.6 base path `<tripId>/<photoId>` and order 0', () => {
    const { db, tripId, placeId } = setup();
    const p = addPhoto(db, {
      tripId,
      ownerType: 'place',
      ownerId: placeId,
      width: 1600,
      height: 1200,
    });
    expect(p.id).toMatch(/[0-9a-f-]{36}/);
    expect(p.tripId).toBe(tripId);
    expect(p.ownerType).toBe('place');
    expect(p.ownerId).toBe(placeId);
    expect(p.path).toBe(`${tripId}/${p.id}`); // base path computed by the repo
    expect(p.width).toBe(1600);
    expect(p.height).toBe(1200);
    expect(p.orderIndex).toBe(0);
    expect(p.createdAt).toEqual(NOW);
    expect(getPhoto(db, p.id)?.path).toBe(`${tripId}/${p.id}`);
  });

  it('addPhoto appends order_index = max(gallery)+1 per owner', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const c = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    expect([a.orderIndex, b.orderIndex, c.orderIndex]).toEqual([0, 1, 2]);
  });

  it('order_index is scoped to (owner_type, owner_id)', () => {
    const { db, tripId, placeId } = setup();
    const other = addPlace(db, {
      tripId,
      name: 'Other',
      category: 'other',
      dayDate: '2026-06-03',
    });
    addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const onOther = addPhoto(db, { tripId, ownerType: 'place', ownerId: other.id });
    expect(onOther.orderIndex).toBe(0); // independent gallery
  });

  it('listByOwner returns the gallery ordered by order_index', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    expect(listByOwner(db, 'place', placeId).map((p) => p.id)).toEqual([a.id, b.id]);
  });

  it('firstForOwner returns the first gallery photo, else undefined', () => {
    const { db, tripId, placeId } = setup();
    expect(firstForOwner(db, 'place', placeId)).toBeUndefined();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    expect(firstForOwner(db, 'place', placeId)?.id).toBe(a.id);
  });

  it('deletePhoto removes the row', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    deletePhoto(db, a.id);
    expect(getPhoto(db, a.id)).toBeUndefined();
  });

  it('reorderOwner renumbers the gallery to match orderedIds', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const c = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    reorderOwner(db, 'place', placeId, [c.id, a.id, b.id]);
    expect(listByOwner(db, 'place', placeId).map((p) => p.id)).toEqual([
      c.id,
      a.id,
      b.id,
    ]);
  });

  it('reorderOwner ignores ids that are not in this gallery', () => {
    const { db, tripId, placeId } = setup();
    const a = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    const b = addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    reorderOwner(db, 'place', placeId, ['ghost', b.id, a.id]);
    expect(listByOwner(db, 'place', placeId).map((p) => p.id)).toEqual([b.id, a.id]);
  });

  it('photos cascade-delete when their trip is deleted', () => {
    const { db, sqlite, tripId, placeId } = setup();
    addPhoto(db, { tripId, ownerType: 'place', ownerId: placeId });
    deleteTrip(db, tripId);
    const { c } = sqlite.prepare('SELECT count(*) AS c FROM photos').get() as {
      c: number;
    };
    expect(c).toBe(0);
  });
});
