import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({ get db() { return testHandle.db; }, sqlite: {} }));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rmFn = vi.fn(async (..._args: any[]) => undefined);
vi.mock('node:fs/promises', () => ({
  default: { rm: (p: string, o?: unknown) => rmFn(p, o) },
  rm: (p: string, o?: unknown) => rmFn(p, o),
}));

import {
  addLinkAction,
  updateLinkAction,
  deleteLinkAction,
} from '@/app/_actions/savedLinks';
import { getLink, listLinksForTrip } from '@/src/db/repos/savedLinks';

const TS = new Date(1_700_000_000_000);

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'place-1', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
    name: 'Castle', address: null, lat: null, lng: null, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null, aiSummary: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('saved-link actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
    rmFn.mockClear();
  });

  it('adds a link and revalidates the journal path', async () => {
    const link = await addLinkAction({
      tripId: 'trip-1',
      url: 'https://example.com/post',
      title: 'A Post',
      note: 'read me',
      thumbnail: 'trip-1/links/thumb-1.webp',
    });
    expect(link.url).toBe('https://example.com/post');
    expect(getLink(testHandle.db, link.id)?.title).toBe('A Post');
    expect(getLink(testHandle.db, link.id)?.thumbnail).toBe('trip-1/links/thumb-1.webp');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
  });

  it('rejects a non-http(s) url', async () => {
    await expect(
      addLinkAction({ tripId: 'trip-1', url: 'javascript:alert(1)' }),
    ).rejects.toThrow();
    await expect(
      addLinkAction({ tripId: 'trip-1', url: 'ftp://example.com/x' }),
    ).rejects.toThrow();
    expect(listLinksForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
  });

  it('updates a link and revalidates', async () => {
    const link = await addLinkAction({ tripId: 'trip-1', url: 'https://example.com' });
    revalidatePath.mockClear();
    const updated = await updateLinkAction(link.id, { title: 'New title', note: 'n' });
    expect(updated.title).toBe('New title');
    expect(updated.note).toBe('n');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
  });

  it('updateLinkAction rejects a non-http url', async () => {
    const link = await addLinkAction({ tripId: 'trip-1', url: 'https://example.com' });
    revalidatePath.mockClear();
    await expect(
      updateLinkAction(link.id, { url: 'javascript:alert(1)' }),
    ).rejects.toThrow();
    await expect(
      updateLinkAction(link.id, { url: 'ftp://example.com/x' }),
    ).rejects.toThrow();
    // Original url should remain unchanged
    expect(getLink(testHandle.db, link.id)?.url).toBe('https://example.com');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('throws when updating a missing link', async () => {
    await expect(updateLinkAction('nope', { title: 'x' })).rejects.toThrow('Link not found');
  });

  it('deletes a link, best-effort removes its thumbnail file, and revalidates', async () => {
    const link = await addLinkAction({
      tripId: 'trip-1', url: 'https://example.com', thumbnail: 'trip-1/links/t.webp',
    });
    revalidatePath.mockClear();
    await deleteLinkAction(link.id);
    expect(getLink(testHandle.db, link.id)).toBeUndefined();
    expect(rmFn).toHaveBeenCalledWith('/uploads/trip-1/links/t.webp', { force: true });
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/journal');
  });

  it('deletes a link with no thumbnail without touching the disk', async () => {
    const link = await addLinkAction({ tripId: 'trip-1', url: 'https://example.com' });
    await deleteLinkAction(link.id);
    expect(getLink(testHandle.db, link.id)).toBeUndefined();
    expect(rmFn).not.toHaveBeenCalled();
  });

  it('does NOT rm when a tampered thumbnail path traverses outside UPLOADS_DIR', async () => {
    const link = await addLinkAction({
      tripId: 'trip-1', url: 'https://example.com', thumbnail: '../../etc/passwd',
    });
    await deleteLinkAction(link.id);
    // Row still deleted; the disk cleanup is skipped because the path escapes root.
    expect(getLink(testHandle.db, link.id)).toBeUndefined();
    expect(rmFn).not.toHaveBeenCalled();
  });

  it('does NOT rm when the thumbnail path resolves to the uploads root itself', async () => {
    const link = await addLinkAction({ tripId: 'trip-1', url: 'https://example.com', thumbnail: '' });
    await deleteLinkAction(link.id);
    expect(rmFn).not.toHaveBeenCalled();
  });

  it('throws when deleting a missing link', async () => {
    await expect(deleteLinkAction('nope')).rejects.toThrow('Link not found');
  });

  it('addLinkAction stores placeId and revalidates the plan', async () => {
    revalidatePath.mockClear();
    const link = await addLinkAction({ tripId: 'trip-1', url: 'https://g.example', placeId: 'place-1' });
    expect(link.placeId).toBe('place-1');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
  });

  it('deleting a place-scoped link revalidates the plan (not the journal)', async () => {
    const link = await addLinkAction({ tripId: 'trip-1', url: 'https://g.example', placeId: 'place-1' });
    revalidatePath.mockClear();
    await deleteLinkAction(link.id);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/plan');
    expect(revalidatePath).not.toHaveBeenCalledWith('/trip/trip-1/journal');
  });
});
