import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import { addPlace, listAllForTrip } from '@/src/db/repos/places';
import { listByTrip, addList, renameList, deleteList } from '@/src/db/repos/savedLists';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date('2026-06-08T12:00:00.000Z');
let db: ReturnType<typeof makeTestDb>['db'];

beforeEach(() => {
  db = makeTestDb().db;
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
});

describe('savedLists repo', () => {
  it('returns [] then lists in insertion order', () => {
    expect(listByTrip(db, 'trip-1')).toEqual([]);
    addList(db, 'trip-1', 'Beaches');
    addList(db, 'trip-1', 'Coffee');
    const rows = listByTrip(db, 'trip-1');
    expect(rows.map((r) => r.name)).toEqual(['Beaches', 'Coffee']);
    expect(rows.map((r) => r.orderIndex)).toEqual([0, 1]);
  });

  it('renames a list', () => {
    const l = addList(db, 'trip-1', 'Old');
    const updated = renameList(db, l.id, 'New');
    expect(updated?.name).toBe('New');
    expect(listByTrip(db, 'trip-1')[0]!.name).toBe('New');
  });

  it('deleting a list un-groups its places (list_id → null) without deleting them', () => {
    const list = addList(db, 'trip-1', 'South Point');
    const a = addPlace(db, { tripId: 'trip-1', dayDate: null, name: 'A', category: 'sightseeing', listId: list.id });
    const b = addPlace(db, { tripId: 'trip-1', dayDate: null, name: 'B', category: 'sightseeing', listId: list.id });
    const loose = addPlace(db, { tripId: 'trip-1', dayDate: null, name: 'C', category: 'sightseeing' });

    deleteList(db, list.id);

    expect(listByTrip(db, 'trip-1')).toEqual([]);
    const all = listAllForTrip(db, 'trip-1');
    expect(all.map((p) => p.id).sort()).toEqual([a.id, b.id, loose.id].sort());
    expect(all.every((p) => p.listId === null)).toBe(true);
  });
});
