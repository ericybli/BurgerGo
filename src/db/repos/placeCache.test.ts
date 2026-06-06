import { describe, it, expect } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    googlePlaceId: 'gpid-1',
    name: 'Tokyo Tower',
    address: '4 Chome-2-8 Shibakoen, Minato City, Tokyo',
    lat: 35.6586,
    lng: 139.7454,
    categoryGuess: 'sightseeing',
    photoRef: 'photo-ref-abc',
    photoLocalPath: 'place-photos/gpid-1/card.webp',
    rawJson: '{"foo":"bar"}',
    fetchedAt: new Date(1_700_000_000_000),
    ...overrides,
  };
}

describe('placeCache repo', () => {
  it('getCachedDetails returns undefined on a miss', () => {
    const { db } = makeTestDb();
    expect(getCachedDetails(db, 'nope')).toBeUndefined();
  });

  it('upsertDetails inserts then reads back the row', () => {
    const { db } = makeTestDb();
    upsertDetails(db, sampleRow());
    const got = getCachedDetails(db, 'gpid-1');
    expect(got).toBeDefined();
    expect(got!.name).toBe('Tokyo Tower');
    expect(got!.lat).toBeCloseTo(35.6586, 4);
    expect(got!.photoLocalPath).toBe('place-photos/gpid-1/card.webp');
    expect(got!.fetchedAt).toEqual(new Date(1_700_000_000_000));
  });

  it('upsertDetails updates an existing row on the same googlePlaceId', () => {
    const { db, sqlite } = makeTestDb();
    upsertDetails(db, sampleRow());
    upsertDetails(
      db,
      sampleRow({
        name: 'Tokyo Tower (renamed)',
        fetchedAt: new Date(1_700_000_500_000),
      }),
    );
    const got = getCachedDetails(db, 'gpid-1');
    expect(got!.name).toBe('Tokyo Tower (renamed)');
    expect(got!.fetchedAt).toEqual(new Date(1_700_000_500_000));

    // Still exactly one row for this key.
    const { c } = sqlite.prepare('SELECT count(*) AS c FROM place_details_cache').get() as { c: number };
    expect(c).toBe(1);
  });
});
