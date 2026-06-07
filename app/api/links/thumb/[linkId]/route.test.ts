// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, savedLinks } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; }, sqlite: {} }));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

const THUMB_BYTES = Buffer.from('FAKE_WEBP');
vi.mock('node:fs/promises', () => {
  const read = async (path: string) => {
    if (path === '/uploads/trip-1/links/ok.webp') return THUMB_BYTES;
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  };
  return { default: { readFile: vi.fn(read) }, readFile: vi.fn(read) };
});

import { GET } from '@/app/api/links/thumb/[linkId]/route';

const TS = new Date(1_700_000_000_000);

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(savedLinks).values({
    id: 'link-ok', tripId: 'trip-1', url: 'https://example.com', title: null,
    note: null, thumbnail: 'trip-1/links/ok.webp', createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(savedLinks).values({
    id: 'link-nothumb', tripId: 'trip-1', url: 'https://example.com', title: null,
    note: null, thumbnail: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(savedLinks).values({
    id: 'link-trav', tripId: 'trip-1', url: 'https://example.com', title: null,
    note: null, thumbnail: '../../etc/passwd', createdAt: TS, updatedAt: TS,
  }).run();
}

function ctx(linkId: string) {
  return { params: Promise.resolve({ linkId }) };
}

describe('GET /api/links/thumb/[linkId]', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('streams the link thumbnail webp with long-cache headers', async () => {
    const res = await GET(new Request('http://x/api/links/thumb/link-ok'), ctx('link-ok'));
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(THUMB_BYTES);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(res.headers.get('cache-control')).toContain('immutable');
  });

  it('returns 404 for an unknown link id', async () => {
    const res = await GET(new Request('http://x/api/links/thumb/nope'), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the link has no thumbnail', async () => {
    const res = await GET(new Request('http://x/api/links/thumb/link-nothumb'), ctx('link-nothumb'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when the file is missing on disk', async () => {
    // Insert a link whose thumbnail path is valid (under root) but not on disk.
    testHandle.db.insert(savedLinks).values({
      id: 'link-gone', tripId: 'trip-1', url: 'https://example.com', title: null,
      note: null, thumbnail: 'trip-1/links/gone.webp', createdAt: TS, updatedAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/links/thumb/link-gone'), ctx('link-gone'));
    expect(res.status).toBe(404);
  });

  it('returns 404 (no read) when the stored thumbnail path traverses out of UPLOADS_DIR', async () => {
    const res = await GET(new Request('http://x/api/links/thumb/link-trav'), ctx('link-trav'));
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('not_found');
  });
});
