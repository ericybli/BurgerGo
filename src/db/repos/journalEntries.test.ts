import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip, deleteTrip } from '@/src/db/repos/trips';
import {
  addEntry,
  getEntry,
  listEntriesForTrip,
  updateEntry,
  deleteEntry,
} from '@/src/db/repos/journalEntries';

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

describe('journalEntries repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addEntry inserts with generated id/timestamps', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, {
      tripId,
      title: 'Day one',
      body: 'Walked Shibuya.',
      entryDate: '2026-06-02',
    });
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.title).toBe('Day one');
    expect(e.body).toBe('Walked Shibuya.');
    expect(e.entryDate).toBe('2026-06-02');
    expect(e.createdAt).toEqual(NOW);
    expect(e.updatedAt).toEqual(NOW);
    expect(getEntry(db, e.id)?.title).toBe('Day one');
  });

  it('addEntry accepts an empty body and a null entryDate', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Untitled', body: '' });
    expect(e.body).toBe('');
    expect(e.entryDate).toBeNull();
  });

  it('listEntriesForTrip orders by created_at desc (newest written first)', () => {
    const { db, tripId } = setup();
    vi.setSystemTime(new Date('2026-06-08T10:00:00Z'));
    const first = addEntry(db, { tripId, title: 'First', body: '' });
    vi.setSystemTime(new Date('2026-06-08T11:00:00Z'));
    const second = addEntry(db, { tripId, title: 'Second', body: '' });
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    const third = addEntry(db, { tripId, title: 'Third', body: '' });
    expect(listEntriesForTrip(db, tripId).map((e) => e.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it('listEntriesForTrip is scoped to the trip', () => {
    const { db, tripId } = setup();
    addEntry(db, { tripId, title: 'Mine', body: '' });
    const other = createTrip(db, {
      name: 'X',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    });
    addEntry(db, { tripId: other.id, title: 'Theirs', body: '' });
    expect(listEntriesForTrip(db, tripId).map((e) => e.title)).toEqual(['Mine']);
  });

  it('updateEntry patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Old', body: 'old body' });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateEntry(db, e.id, {
      title: 'New',
      body: 'new body',
      entryDate: null,
    });
    expect(updated?.title).toBe('New');
    expect(updated?.body).toBe('new body');
    expect(updated?.entryDate).toBeNull();
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
    expect(updated?.createdAt).toEqual(NOW);
  });

  it('updateEntry returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateEntry(db, 'nope', { title: 'x' })).toBeUndefined();
  });

  it('deleteEntry removes the row', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Bye', body: '' });
    deleteEntry(db, e.id);
    expect(getEntry(db, e.id)).toBeUndefined();
  });

  it('deleting the trip cascades to its entries', () => {
    const { db, tripId } = setup();
    const e = addEntry(db, { tripId, title: 'Doomed', body: '' });
    deleteTrip(db, tripId);
    expect(getEntry(db, e.id)).toBeUndefined();
  });
});
