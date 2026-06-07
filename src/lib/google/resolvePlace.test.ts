import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { getCachedDetails } from '@/src/db/repos/placeCache';

const fetchPlaceAutocomplete = vi.fn();
const fetchPlaceDetails = vi.fn();
vi.mock('@/src/lib/google/server', () => ({
  fetchPlaceAutocomplete: (...a: unknown[]) => fetchPlaceAutocomplete(...a),
  fetchPlaceDetails: (...a: unknown[]) => fetchPlaceDetails(...a),
}));
const fetchAndStoreGooglePhoto = vi.fn();
vi.mock('@/src/lib/google/photo', () => ({
  fetchAndStoreGooglePhoto: (...a: unknown[]) => fetchAndStoreGooglePhoto(...a),
}));

import { resolvePlaceByName } from '@/src/lib/google/resolvePlace';

let db: ReturnType<typeof makeTestDb>['db'];
const ARGS = { apiKey: 'K', uploadsDir: '/tmp/uploads' };

beforeEach(() => {
  db = makeTestDb().db;
  fetchPlaceAutocomplete.mockReset();
  fetchPlaceDetails.mockReset();
  fetchAndStoreGooglePhoto.mockReset();
});

describe('resolvePlaceByName', () => {
  it('autocompletes name+area, fetches details, downloads the photo, caches, returns coords/address', async () => {
    fetchPlaceAutocomplete.mockResolvedValue([{ placeId: 'gid-1', description: 'Ichiran, Tokyo' }]);
    fetchPlaceDetails.mockResolvedValue({
      googlePlaceId: 'gid-1', name: 'Ichiran Ramen', address: '1-2-3 Tokyo',
      lat: 35.6, lng: 139.7, categoryGuess: 'other', photoRef: 'PREF',
    });
    fetchAndStoreGooglePhoto.mockResolvedValue('gphotos/gid-1.webp');

    const r = await resolvePlaceByName(db, { name: 'Ichiran', area: 'Tokyo', ...ARGS });
    expect(r).toMatchObject({
      googlePlaceId: 'gid-1', name: 'Ichiran Ramen', address: '1-2-3 Tokyo',
      lat: 35.6, lng: 139.7, photoLocalPath: 'gphotos/gid-1.webp',
    });
    expect(fetchPlaceAutocomplete).toHaveBeenCalledWith({ input: 'Ichiran Tokyo', apiKey: 'K' });
    expect(fetchAndStoreGooglePhoto).toHaveBeenCalled();
    expect(getCachedDetails(db, 'gid-1')?.photoLocalPath).toBe('gphotos/gid-1.webp');
  });

  it('returns null when autocomplete has no predictions', async () => {
    fetchPlaceAutocomplete.mockResolvedValue([]);
    expect(await resolvePlaceByName(db, { name: 'Nowhere', ...ARGS })).toBeNull();
    expect(fetchPlaceDetails).not.toHaveBeenCalled();
  });

  it('returns null for an empty name (no Google call)', async () => {
    expect(await resolvePlaceByName(db, { name: '  ', ...ARGS })).toBeNull();
    expect(fetchPlaceAutocomplete).not.toHaveBeenCalled();
  });

  it('reuses a cached details row on the second resolve (no second details/photo fetch)', async () => {
    fetchPlaceAutocomplete.mockResolvedValue([{ placeId: 'gid-2', description: 'X' }]);
    fetchPlaceDetails.mockResolvedValue({ googlePlaceId: 'gid-2', name: 'X', address: 'A', lat: 1, lng: 2, categoryGuess: 'other', photoRef: 'P' });
    fetchAndStoreGooglePhoto.mockResolvedValue('gphotos/gid-2.webp');

    await resolvePlaceByName(db, { name: 'X', ...ARGS });
    const r2 = await resolvePlaceByName(db, { name: 'X', ...ARGS });
    expect(fetchPlaceDetails).toHaveBeenCalledTimes(1);
    expect(fetchAndStoreGooglePhoto).toHaveBeenCalledTimes(1);
    expect(r2?.photoLocalPath).toBe('gphotos/gid-2.webp');
  });

  it('treats (0,0) geometry as no coordinates', async () => {
    fetchPlaceAutocomplete.mockResolvedValue([{ placeId: 'gid-3', description: 'Y' }]);
    fetchPlaceDetails.mockResolvedValue({ googlePlaceId: 'gid-3', name: 'Y', address: '', lat: 0, lng: 0, categoryGuess: 'other', photoRef: null });
    const r = await resolvePlaceByName(db, { name: 'Y', ...ARGS });
    expect(r).toMatchObject({ googlePlaceId: 'gid-3', lat: null, lng: null, address: null });
  });
});
