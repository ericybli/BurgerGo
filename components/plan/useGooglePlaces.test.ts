/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Capture the sessionToken passed to getPlacePredictions so we can assert it.
let lastSearchSessionToken: string | undefined;

// Mock the loader so no real Maps JS is injected.
// loadGoogleMaps now resolves with the maps namespace directly (not {maps}).
vi.mock('@/src/lib/google/loader', () => {
  return {
    loadGoogleMaps: vi.fn().mockResolvedValue({
      places: {
        AutocompleteService: class {
          getPlacePredictions(
            req: { input: string; sessionToken: string },
            cb: (r: unknown[], s: string) => void,
          ) {
            lastSearchSessionToken = req.sessionToken;
            cb(
              [{ place_id: 'pid-1', description: 'Senso-ji Temple, Tokyo' }],
              'OK',
            );
          }
        },
      },
    }),
    __resetMapsLoaderForTests: vi.fn(),
  };
});

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  lastSearchSessionToken = undefined;
});

import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';

describe('usePlacesAutocomplete', () => {
  it('returns an empty predictions array initially', () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    expect(result.current.predictions).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('populates predictions after search is called', async () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    await act(async () => {
      await result.current.search('senso');
    });
    expect(result.current.predictions).toHaveLength(1);
    expect(result.current.predictions[0]!.placeId).toBe('pid-1');
    expect(result.current.predictions[0]!.description).toBe('Senso-ji Temple, Tokyo');
  });

  it('calls /api/google/details on select and returns the normalized place', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        googlePlaceId: 'pid-1',
        name: 'Senso-ji Temple',
        address: 'Asakusa, Tokyo',
        lat: 35.71,
        lng: 139.79,
        categoryGuess: 'sightseeing',
        photoRef: 'R',
        photoLocalPath: null,
        cached: false,
      }),
    });

    const { result } = renderHook(() => usePlacesAutocomplete());
    await act(async () => { await result.current.search('senso'); });

    let place: Awaited<ReturnType<typeof result.current.select>> | undefined;
    await act(async () => {
      place = await result.current.select('pid-1');
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/api/google/details');
    expect(calledUrl).toContain('placeId=pid-1');

    expect(place?.name).toBe('Senso-ji Temple');
    expect(place?.categoryGuess).toBe('sightseeing');
  });

  it('passes the same UUID session token to search and select (not "undefined")', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        googlePlaceId: 'pid-1', name: 'Senso-ji Temple', address: 'Asakusa, Tokyo',
        lat: 35.71, lng: 139.79, categoryGuess: 'sightseeing',
        photoRef: null, photoLocalPath: null, cached: false,
      }),
    });

    const { result } = renderHook(() => usePlacesAutocomplete());

    // search() should capture the session token passed to getPlacePredictions.
    await act(async () => { await result.current.search('senso'); });
    const searchToken = lastSearchSessionToken;

    // The token must be a valid UUID (not "undefined" or empty).
    expect(searchToken).toBeTruthy();
    expect(searchToken).not.toBe('undefined');
    expect(searchToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // select() must send the same token in the URL.
    await act(async () => { await result.current.select('pid-1'); });
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    const urlParams = new URLSearchParams(calledUrl.split('?')[1]);
    const detailsToken = urlParams.get('sessionToken');
    expect(detailsToken).toBe(searchToken);
  });

  it('rotates the session token after select (fresh session for next search)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        googlePlaceId: 'pid-1', name: 'Senso-ji', address: 'Tokyo',
        lat: 35.71, lng: 139.79, categoryGuess: 'sightseeing',
        photoRef: null, photoLocalPath: null, cached: false,
      }),
    });

    const { result } = renderHook(() => usePlacesAutocomplete());

    // First session: search then select.
    await act(async () => { await result.current.search('senso'); });
    const tokenSession1 = lastSearchSessionToken;
    await act(async () => { await result.current.select('pid-1'); });

    // Second session: search again — token must have rotated.
    lastSearchSessionToken = undefined;
    await act(async () => { await result.current.search('temple'); });
    const tokenSession2 = lastSearchSessionToken;

    expect(tokenSession1).toBeTruthy();
    expect(tokenSession2).toBeTruthy();
    expect(tokenSession1).not.toBe(tokenSession2);
  });
});
