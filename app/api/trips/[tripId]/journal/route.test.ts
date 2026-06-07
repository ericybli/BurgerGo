import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, photos } from '@/src/db/schema';
import { addEntry } from '@/src/db/repos/journalEntries';
import { addLink } from '@/src/db/repos/savedLinks';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/journal/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]/journal', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://t/'), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('returns entries newest-first, each with its journal photos, plus links', async () => {
    const a = addEntry(testHandle.db, { tripId: 'trip-1', title: 'First', body: 'hello', entryDate: '2026-06-05' });
    const b = addEntry(testHandle.db, { tripId: 'trip-1', title: 'Second', body: '', entryDate: null });
    // a photo for entry `a` only (owner_type journal)
    testHandle.db.insert(photos).values({
      id: 'ph1', tripId: 'trip-1', ownerType: 'journal', ownerId: a.id,
      path: `trip-1/ph1`, width: 800, height: 600, orderIndex: 0, createdAt: TS,
    }).run();
    // a non-journal photo on the same trip must NOT leak into any entry
    testHandle.db.insert(photos).values({
      id: 'ph2', tripId: 'trip-1', ownerType: 'place', ownerId: 'some-place',
      path: `trip-1/ph2`, width: 800, height: 600, orderIndex: 0, createdAt: TS,
    }).run();
    addLink(testHandle.db, { tripId: 'trip-1', url: 'https://example.com', title: 'Ex', note: null, thumbnail: null });

    const res = await GET(new Request('http://t/'), ctx('trip-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ id: string; title: string; photos: Array<{ id: string }> }>;
      links: Array<{ url: string }>;
    };
    // newest-written (created_at DESC) first → b before a
    expect(body.entries.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(body.entries.find((e) => e.id === a.id)!.photos.map((p) => p.id)).toEqual(['ph1']);
    expect(body.entries.find((e) => e.id === b.id)!.photos).toEqual([]);
    expect(body.links.map((l) => l.url)).toEqual(['https://example.com']);
  });

  it('returns empty arrays for a trip with no journal data', async () => {
    const res = await GET(new Request('http://t/'), ctx('trip-1'));
    const body = (await res.json()) as { entries: unknown[]; links: unknown[] };
    expect(body.entries).toEqual([]);
    expect(body.links).toEqual([]);
  });
});
