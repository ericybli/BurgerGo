import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, tripMembers, user } from '@/src/db/schema';
import { getPrincipal } from '@/src/lib/authz';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { TZ: 'UTC' } }));

// Pin "today" inside the active window of "active-1".
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));

import { GET } from '@/app/api/trips/route';

const req = () => new Request('http://x/api/trips');

function seed(db: ReturnType<typeof makeTestDb>['db'], memberOf: string[]) {
  const ts = new Date('2026-06-08T12:00:00.000Z');
  db.insert(trips).values([
    { id: 'past-1', name: 'Past', startDate: '2026-01-01', endDate: '2026-01-05', coverPhoto: null, createdAt: ts, updatedAt: ts },
    { id: 'active-1', name: 'Active', startDate: '2026-06-05', endDate: '2026-06-12', coverPhoto: null, createdAt: ts, updatedAt: ts },
    { id: 'upcoming-1', name: 'Upcoming', startDate: '2026-07-01', endDate: '2026-07-05', coverPhoto: null, createdAt: ts, updatedAt: ts },
  ]).run();
  // The mocked principal is { kind: 'user', userId: 'test-user' } — claimed
  // memberships drive what GET returns for user principals.
  db.insert(user).values({
    id: 'test-user', name: 'Test', email: 'test@example.com',
    emailVerified: true, image: null, createdAt: ts, updatedAt: ts,
  }).run();
  if (memberOf.length > 0) {
    db.insert(tripMembers).values(memberOf.map((tripId, i) => ({
      id: `m-${i}`, tripId, userId: 'test-user', invitedEmail: 'test@example.com',
      role: 'owner' as const, createdAt: ts,
    }))).run();
  }
}

describe('GET /api/trips', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
  });

  it('returns 200 with the member trips Active-first', async () => {
    seed(testHandle.db, ['past-1', 'active-1', 'upcoming-1']);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body.map((t) => t.id)).toEqual(['active-1', 'past-1', 'upcoming-1']);
  });

  it('only lists trips the user is a member of', async () => {
    seed(testHandle.db, ['active-1']);
    const body = (await (await GET(req())).json()) as Array<{ id: string }>;
    expect(body.map((t) => t.id)).toEqual(['active-1']);
  });

  it('machine principals see every trip', async () => {
    seed(testHandle.db, []);
    vi.mocked(getPrincipal).mockResolvedValueOnce({ kind: 'machine' });
    const body = (await (await GET(req())).json()) as Array<{ id: string }>;
    expect(body.map((t) => t.id)).toEqual(['active-1', 'past-1', 'upcoming-1']);
  });

  it('rejects unauthenticated requests with 401', async () => {
    seed(testHandle.db, ['active-1']);
    vi.mocked(getPrincipal).mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(401);
  });
});
