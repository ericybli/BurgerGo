// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { TZ: 'UTC' } }));
// Freeze "today" at 2026-06-08 so the forecast/archive cutoff is deterministic.
vi.mock('@/src/lib/clock', () => ({ now: () => Date.parse('2026-06-08T12:00:00Z') }));

let lastUrl = '';
const weatherJson = {
  daily: {
    temperature_2m_max: [28], temperature_2m_min: [22],
    weather_code: [61], precipitation_probability_max: [40],
  },
};

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  lastUrl = '';
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    lastUrl = url;
    return { ok: true, json: async () => weatherJson } as unknown as Response;
  }));
});

import { GET } from '@/app/api/trips/[tripId]/weather/route';

const TS = new Date('2026-06-08T12:00:00.000Z');
function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}
function seed(db: ReturnType<typeof makeTestDb>['db'], coords = true) {
  db.insert(trips).values({
    id: 't1', name: 'T', startDate: '2026-06-04', endDate: '2026-09-12',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'p1', tripId: 't1', dayDate: '2026-06-10', googlePlaceId: null, name: 'X',
    address: null, lat: coords ? 19.6 : null, lng: coords ? -155.9 : null,
    category: 'sightseeing', scheduledTime: null, durationMin: null, cost: null,
    notes: null, orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('GET /api/trips/[tripId]/weather', () => {
  it('404s for an unknown trip', async () => {
    const r = await GET(new Request('http://x/api/trips/none/weather?date=2026-06-10'), ctx('none'));
    expect(r.status).toBe(404);
  });

  it('400s for a malformed date', async () => {
    seed(testHandle.db);
    const r = await GET(new Request('http://x/api/trips/t1/weather?date=nope'), ctx('t1'));
    expect(r.status).toBe(400);
  });

  it('returns null weather when the trip has no pinned coords', async () => {
    seed(testHandle.db, false);
    const r = await GET(new Request('http://x/api/trips/t1/weather?date=2026-06-10'), ctx('t1'));
    expect((await r.json()).weather).toBeNull();
  });

  it('uses the forecast endpoint within ~16 days', async () => {
    seed(testHandle.db);
    const r = await GET(new Request('http://x/api/trips/t1/weather?date=2026-06-10'), ctx('t1'));
    const { weather } = await r.json();
    expect(lastUrl).toContain('/v1/forecast');
    expect(weather).toMatchObject({ tMaxC: 28, tMinC: 22, code: 61, precipProb: 40, source: 'forecast', date: '2026-06-10' });
  });

  it('falls back to last-year archive (climate normal) for far-future dates', async () => {
    seed(testHandle.db);
    const r = await GET(new Request('http://x/api/trips/t1/weather?date=2026-09-05'), ctx('t1'));
    const { weather } = await r.json();
    expect(lastUrl).toContain('/v1/archive');
    expect(lastUrl).toContain('2025-09-05'); // same date, prior year
    // Normal proxy drops precip probability but stamps the trip date back on.
    expect(weather).toMatchObject({ source: 'normal', date: '2026-09-05', precipProb: null });
  });
});
