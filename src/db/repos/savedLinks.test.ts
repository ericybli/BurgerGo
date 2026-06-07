import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip, deleteTrip } from '@/src/db/repos/trips';
import { addPlace } from '@/src/db/repos/places';
import {
  addLink,
  getLink,
  listLinksForTrip,
  listLinksForPlace,
  updateLink,
  deleteLink,
} from '@/src/db/repos/savedLinks';

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

describe('savedLinks repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addLink inserts with generated id/timestamps', () => {
    const { db, tripId } = setup();
    const l = addLink(db, {
      tripId,
      url: 'https://example.com/post',
      title: 'A post',
      note: 'read later',
      thumbnail: 't1/links/abc',
    });
    expect(l.id).toMatch(/[0-9a-f-]{36}/);
    expect(l.url).toBe('https://example.com/post');
    expect(l.title).toBe('A post');
    expect(l.note).toBe('read later');
    expect(l.thumbnail).toBe('t1/links/abc');
    expect(l.createdAt).toEqual(NOW);
    expect(l.updatedAt).toEqual(NOW);
    expect(getLink(db, l.id)?.url).toBe('https://example.com/post');
  });

  it('addLink defaults optional fields to null', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com' });
    expect(l.title).toBeNull();
    expect(l.note).toBeNull();
    expect(l.thumbnail).toBeNull();
  });

  it('listLinksForTrip orders by created_at desc', () => {
    const { db, tripId } = setup();
    vi.setSystemTime(new Date('2026-06-08T10:00:00Z'));
    const first = addLink(db, { tripId, url: 'https://a.com' });
    vi.setSystemTime(new Date('2026-06-08T11:00:00Z'));
    const second = addLink(db, { tripId, url: 'https://b.com' });
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const third = addLink(db, { tripId, url: 'https://c.com' });
    expect(listLinksForTrip(db, tripId).map((l) => l.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it('listLinksForTrip is scoped to the trip', () => {
    const { db, tripId } = setup();
    addLink(db, { tripId, url: 'https://mine.com' });
    const other = createTrip(db, {
      name: 'X',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    });
    addLink(db, { tripId: other.id, url: 'https://theirs.com' });
    expect(listLinksForTrip(db, tripId).map((l) => l.url)).toEqual([
      'https://mine.com',
    ]);
  });

  it('updateLink patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com', title: 'Old' });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateLink(db, l.id, { title: 'New', note: 'noted' });
    expect(updated?.title).toBe('New');
    expect(updated?.note).toBe('noted');
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
    expect(updated?.createdAt).toEqual(NOW);
  });

  it('updateLink can clear nullable fields', () => {
    const { db, tripId } = setup();
    const l = addLink(db, {
      tripId,
      url: 'https://example.com',
      title: 'T',
      thumbnail: 't1/links/x',
    });
    const updated = updateLink(db, l.id, { title: null, thumbnail: null });
    expect(updated?.title).toBeNull();
    expect(updated?.thumbnail).toBeNull();
  });

  it('updateLink returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateLink(db, 'nope', { title: 'x' })).toBeUndefined();
  });

  it('deleteLink removes the row', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com' });
    deleteLink(db, l.id);
    expect(getLink(db, l.id)).toBeUndefined();
  });

  it('deleting the trip cascades to its links', () => {
    const { db, tripId } = setup();
    const l = addLink(db, { tripId, url: 'https://example.com' });
    deleteTrip(db, tripId);
    expect(getLink(db, l.id)).toBeUndefined();
  });

  it('place links are excluded from the trip reading list and listed per place', () => {
    const { db } = makeTestDb();
    const trip = createTrip(db, { name: 'Tokyo', startDate: '2026-06-01', endDate: '2026-06-10' });
    const place = addPlace(db, { tripId: trip.id, name: 'P', category: 'other', dayDate: '2026-06-02' });
    addLink(db, { tripId: trip.id, url: 'https://a.example' });                         // reading list
    addLink(db, { tripId: trip.id, url: 'https://b.example', placeId: place.id });      // place link
    expect(listLinksForTrip(db, trip.id).map((l) => l.url)).toEqual(['https://a.example']);
    expect(listLinksForPlace(db, place.id).map((l) => l.url)).toEqual(['https://b.example']);
  });
});
