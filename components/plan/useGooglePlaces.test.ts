/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const DETAILS = {
  googlePlaceId: 'pid-1', name: 'Senso-ji Temple', address: 'Asakusa, Tokyo',
  lat: 35.71, lng: 139.79, categoryGuess: 'sightseeing',
  photoRef: 'R', photoLocalPath: null, cached: false,
};

// One fetch spy that routes by URL: autocomplete → predictions, details → place.
let fetchSpy: ReturnType<typeof vi.fn>;
function routeFetch() {
  fetchSpy = vi.fn(async (url: string) => {
    if (String(url).includes('/api/google/autocomplete')) {
      return {
        ok: true,
        json: async () => ({ predictions: [{ placeId: 'pid-1', description: 'Senso-ji Temple, Tokyo' }] }),
      };
    }
    return { ok: true, json: async () => DETAILS };
  });
  vi.stubGlobal('fetch', fetchSpy);
}

beforeEach(() => {
  routeFetch();
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  vi.resetModules();
});

import { usePlacesAutocomplete } from '@/components/plan/useGooglePlaces';

function tokenFromUrl(url: string): string | null {
  return new URLSearchParams(url.split('?')[1] ?? '').get('sessionToken');
}

describe('usePlacesAutocomplete', () => {
  it('returns an empty predictions array initially', () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    expect(result.current.predictions).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('populates predictions from the autocomplete proxy', async () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    await act(async () => { await result.current.search('senso'); });
    expect(result.current.predictions).toHaveLength(1);
    expect(result.current.predictions[0]!.placeId).toBe('pid-1');
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain('/api/google/autocomplete');
    expect(url).toContain('input=senso');
  });

  it('does not call the proxy for an empty query', async () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    await act(async () => { await result.current.search('   '); });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.predictions).toEqual([]);
  });

  it('select calls /api/google/details and returns the normalized place', async () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    let place: Awaited<ReturnType<typeof result.current.select>> | undefined;
    await act(async () => { place = await result.current.select('pid-1'); });
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain('/api/google/details');
    expect(url).toContain('placeId=pid-1');
    expect(place?.name).toBe('Senso-ji Temple');
    expect(place?.categoryGuess).toBe('sightseeing');
  });

  it('passes the same UUID session token to search (autocomplete) and select (details)', async () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    await act(async () => { await result.current.search('senso'); });
    const searchToken = tokenFromUrl(fetchSpy.mock.calls[0]![0] as string);
    expect(searchToken).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    await act(async () => { await result.current.select('pid-1'); });
    const selectToken = tokenFromUrl(fetchSpy.mock.calls[1]![0] as string);
    expect(selectToken).toBe(searchToken);
  });

  it('prefixes endpoints with the base path when NEXT_PUBLIC_BASE_PATH is set', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_BASE_PATH = '/burgergo';
    const { usePlacesAutocomplete: prefixed } = await import('@/components/plan/useGooglePlaces');
    const { result } = renderHook(() => prefixed());
    await act(async () => { await result.current.search('senso'); });
    const url = new URL(fetchSpy.mock.calls[0]![0] as string, 'http://x');
    expect(url.pathname).toBe('/burgergo/api/google/autocomplete');
  });

  it('rotates the session token after select (fresh session for next search)', async () => {
    const { result } = renderHook(() => usePlacesAutocomplete());
    await act(async () => { await result.current.search('senso'); });
    const token1 = tokenFromUrl(fetchSpy.mock.calls[0]![0] as string);
    await act(async () => { await result.current.select('pid-1'); });
    await act(async () => { await result.current.search('temple'); });
    const token2 = tokenFromUrl(fetchSpy.mock.calls[2]![0] as string);
    expect(token1).toBeTruthy();
    expect(token2).toBeTruthy();
    expect(token1).not.toBe(token2);
  });
});
