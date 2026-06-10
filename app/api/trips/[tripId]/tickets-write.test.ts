// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, tickets, ticketFiles } from '@/src/db/schema';
import { addTicket, addTicketFile, getTicket, getTicketFile } from '@/src/db/repos/tickets';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

// The delete actions remove attachment bytes from disk; capture instead of touching fs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rmFn = vi.fn(async (..._args: any[]) => undefined);
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rm: (path: string, opts?: unknown) => rmFn(path, opts) };
});

import { POST as CREATE_TICKET } from '@/app/api/trips/[tripId]/tickets/route';
import { PATCH as PATCH_TICKET, DELETE as DELETE_TICKET } from '@/app/api/trips/[tripId]/tickets/[ticketId]/route';
import { DELETE as DELETE_FILE } from '@/app/api/tickets/files/[fileId]/route';

const TS = new Date('2026-06-09T12:00:00.000Z');
type Db = ReturnType<typeof makeTestDb>['db'];

function req(body?: unknown, key?: string) {
  return new Request('http://x', {
    method: 'POST',
    headers: key ? { 'x-api-key': key } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const del = () => new Request('http://x', { method: 'DELETE' });
const P = <T extends object>(o: T) => ({ params: Promise.resolve(o) });

function seedTrip(db: Db) {
  db.insert(trips).values({
    id: 't1', name: 'Trip', startDate: '2026-09-04', endDate: '2026-09-12',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  seedTrip(testHandle.db);
  rmFn.mockClear();
});
afterEach(() => {
  delete process.env.BURGERGO_API_KEY;
});

describe('tickets write API', () => {
  it('create → patch → delete round-trip', async () => {
    const created = await CREATE_TICKET(
      req({ title: 'Flight BA-12', date: '2026-09-05', time: '09:30', location: 'HNL', note: 'Gate 12' }),
      P({ tripId: 't1' }),
    );
    expect(created.status).toBe(200);
    const ticket = (await created.json()).ticket as { id: string; title: string; time: string };
    expect(ticket.title).toBe('Flight BA-12');
    expect(ticket.time).toBe('09:30');

    const patched = await PATCH_TICKET(
      req({ title: 'Flight BA-12 (rebooked)', time: null }),
      P({ tripId: 't1', ticketId: ticket.id }),
    );
    expect(patched.status).toBe(200);
    const updated = (await patched.json()).ticket as { title: string; time: string | null };
    expect(updated.title).toBe('Flight BA-12 (rebooked)');
    expect(updated.time).toBeNull();

    const deleted = await DELETE_TICKET(del(), P({ tripId: 't1', ticketId: ticket.id }));
    expect(deleted.status).toBe(200);
    expect(getTicket(testHandle.db, ticket.id)).toBeUndefined();
  });

  it('create: title-only body works (optional fields default null)', async () => {
    const res = await CREATE_TICKET(req({ title: 'Museum entry' }), P({ tripId: 't1' }));
    expect(res.status).toBe(200);
    const ticket = (await res.json()).ticket as { date: string | null; location: string | null };
    expect(ticket.date).toBeNull();
    expect(ticket.location).toBeNull();
  });

  it('create: missing title → 400; unknown trip → 404', async () => {
    const bad = await CREATE_TICKET(req({ date: '2026-09-05' }), P({ tripId: 't1' }));
    expect(bad.status).toBe(400);
    const missing = await CREATE_TICKET(req({ title: 'x' }), P({ tripId: 'nope' }));
    expect(missing.status).toBe(404);
  });

  it('PATCH / DELETE a missing ticket id → 404', async () => {
    const patch = await PATCH_TICKET(req({ title: 'x' }), P({ tripId: 't1', ticketId: 'nope' }));
    expect(patch.status).toBe(404);
    const remove = await DELETE_TICKET(del(), P({ tripId: 't1', ticketId: 'nope' }));
    expect(remove.status).toBe(404);
  });

  it('delete removes attachment bytes (rm per file + per-ticket dir) and rows cascade', async () => {
    const ticket = addTicket(testHandle.db, { tripId: 't1', title: 'Train' });
    const file = addTicketFile(testHandle.db, {
      ticketId: ticket.id, tripId: 't1', name: 'qr.png',
      path: `tickets/${ticket.id}/f1`, mime: 'image/png', size: 10,
    });
    const res = await DELETE_TICKET(del(), P({ tripId: 't1', ticketId: ticket.id }));
    expect(res.status).toBe(200);
    expect(rmFn).toHaveBeenCalledWith(`/uploads/tickets/${ticket.id}/f1`, { force: true });
    expect(rmFn).toHaveBeenCalledWith(`/uploads/tickets/${ticket.id}`, { recursive: true, force: true });
    expect(testHandle.db.select().from(tickets).all()).toHaveLength(0);
    expect(getTicketFile(testHandle.db, file.id)).toBeUndefined();
  });

  it('file DELETE removes the row + bytes; missing file → 404', async () => {
    const ticket = addTicket(testHandle.db, { tripId: 't1', title: 'Show' });
    const file = addTicketFile(testHandle.db, {
      ticketId: ticket.id, tripId: 't1', name: 'booking.pdf',
      path: `tickets/${ticket.id}/f2`, mime: 'application/pdf', size: 20,
    });
    const res = await DELETE_FILE(del(), P({ fileId: file.id }));
    expect(res.status).toBe(200);
    expect(rmFn).toHaveBeenCalledWith(`/uploads/tickets/${ticket.id}/f2`, { force: true });
    expect(testHandle.db.select().from(ticketFiles).all()).toHaveLength(0);
    expect(getTicket(testHandle.db, ticket.id)).toBeDefined(); // ticket itself stays

    const missing = await DELETE_FILE(del(), P({ fileId: 'nope' }));
    expect(missing.status).toBe(404);
  });

  it('enforces the write key when BURGERGO_API_KEY is set', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    const noKey = await CREATE_TICKET(req({ title: 'x' }), P({ tripId: 't1' }));
    expect(noKey.status).toBe(401);
    const withKey = await CREATE_TICKET(req({ title: 'x' }, 'secret'), P({ tripId: 't1' }));
    expect(withKey.status).toBe(200);
  });
});
