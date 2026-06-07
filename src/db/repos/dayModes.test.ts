import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import { listDayModes, setDayMode } from '@/src/db/repos/dayModes';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date('2026-06-08T12:00:00.000Z');
let handle: ReturnType<typeof makeTestDb>;

beforeEach(() => {
  handle = makeTestDb();
  handle.db
    .insert(trips)
    .values({
      id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    })
    .run();
});

describe('dayModes repo', () => {
  it('returns [] when no day modes are stored', () => {
    expect(listDayModes(handle.db, 'trip-1')).toEqual([]);
  });

  it('upserts a day mode and lists it', () => {
    const row = setDayMode(handle.db, 'trip-1', '2026-06-05', 'drive');
    expect(row).toMatchObject({ tripId: 'trip-1', dayDate: '2026-06-05', mode: 'drive' });
    expect(listDayModes(handle.db, 'trip-1')).toHaveLength(1);
  });

  it('overwrites on conflict (same trip+day) instead of duplicating', () => {
    setDayMode(handle.db, 'trip-1', '2026-06-05', 'drive');
    setDayMode(handle.db, 'trip-1', '2026-06-05', 'transit');
    const rows = listDayModes(handle.db, 'trip-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.mode).toBe('transit');
  });

  it('stores distinct days independently', () => {
    setDayMode(handle.db, 'trip-1', '2026-06-05', 'drive');
    setDayMode(handle.db, 'trip-1', '2026-06-06', 'walk');
    const byDay = Object.fromEntries(listDayModes(handle.db, 'trip-1').map((r) => [r.dayDate, r.mode]));
    expect(byDay).toEqual({ '2026-06-05': 'drive', '2026-06-06': 'walk' });
  });
});
