/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the loader so no real Maps JS is injected.
vi.mock('@/src/lib/google/loader', () => {
  const SessionTokenManager = class<T> {
    private token: T | null = null;
    constructor(private mint: () => T) {}
    current(): T { if (!this.token) this.token = this.mint(); return this.token; }
    consume(): void { this.token = null; }
    reset(): void { this.token = null; }
  };
  return {
    loadGoogleMaps: vi.fn().mockResolvedValue({
      maps: {
        places: {
          AutocompleteService: class {
            getPlacePredictions(
              _req: unknown,
              cb: (r: unknown[], s: string) => void,
            ) {
              cb(
                [{ place_id: 'pid-1', description: 'Senso-ji Temple, Tokyo' }],
                'OK',
              );
            }
          },
          AutocompleteSessionToken: class { id = 'tok-1'; },
        },
      },
    }),
    SessionTokenManager,
    __resetMapsLoaderForTests: vi.fn(),
  };
});

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
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
      place = await result.current.select('pid-1', 'sess-token');
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('/api/google/details');
    expect(calledUrl).toContain('placeId=pid-1');

    expect(place?.name).toBe('Senso-ji Temple');
    expect(place?.categoryGuess).toBe('sightseeing');
  });
});
