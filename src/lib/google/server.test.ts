import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeDetails,
  normalizeReverseGeocode,
  normalizeForwardGeocode,
  normalizeDirections,
  normalizeAutocomplete,
  fetchPlaceDetails,
  fetchReverseGeocode,
  fetchForwardGeocode,
  fetchDirections,
  fetchPlaceAutocomplete,
  GoogleApiError,
} from '@/src/lib/google/server';

describe('normalizeDetails', () => {
  it('maps a Place Details OK payload to the normalized shape', () => {
    const raw = {
      status: 'OK',
      result: {
        place_id: 'gpid-1',
        name: 'Senso-ji Temple',
        formatted_address: '2 Chome-3-1 Asakusa, Tokyo',
        geometry: { location: { lat: 35.714765, lng: 139.796655 } },
        types: ['tourist_attraction', 'place_of_worship', 'point_of_interest'],
        photos: [{ photo_reference: 'PHOTO_REF_A', width: 4000, height: 3000 }],
      },
    };
    expect(normalizeDetails(raw)).toEqual({
      googlePlaceId: 'gpid-1',
      name: 'Senso-ji Temple',
      address: '2 Chome-3-1 Asakusa, Tokyo',
      lat: 35.714765,
      lng: 139.796655,
      categoryGuess: 'sightseeing',
      photoRef: 'PHOTO_REF_A',
    });
  });

  it('maps lodging types to lodging and unknown to other; tolerates no photo', () => {
    expect(
      normalizeDetails({
        status: 'OK',
        result: {
          place_id: 'h1', name: 'Hotel', formatted_address: 'X',
          geometry: { location: { lat: 1, lng: 2 } },
          types: ['lodging'],
        },
      }).categoryGuess,
    ).toBe('lodging');
    expect(
      normalizeDetails({
        status: 'OK',
        result: {
          place_id: 'z1', name: 'Mystery', formatted_address: 'Y',
          geometry: { location: { lat: 1, lng: 2 } },
          types: ['locality'],
        },
      }).categoryGuess,
    ).toBe('other');
  });

  it('throws GoogleApiError on a non-OK status', () => {
    expect(() => normalizeDetails({ status: 'OVER_QUERY_LIMIT' })).toThrow(GoogleApiError);
  });
});

describe('normalizeReverseGeocode', () => {
  it('returns the first formatted_address on OK', () => {
    const raw = {
      status: 'OK',
      results: [
        { formatted_address: '1-1 Marunouchi, Chiyoda City, Tokyo' },
        { formatted_address: 'Chiyoda City, Tokyo' },
      ],
    };
    expect(normalizeReverseGeocode(raw)).toEqual({
      address: '1-1 Marunouchi, Chiyoda City, Tokyo',
    });
  });

  it('returns address:null on ZERO_RESULTS (no throw)', () => {
    expect(normalizeReverseGeocode({ status: 'ZERO_RESULTS', results: [] })).toEqual({
      address: null,
    });
  });

  it('throws GoogleApiError on REQUEST_DENIED', () => {
    expect(() => normalizeReverseGeocode({ status: 'REQUEST_DENIED' })).toThrow(GoogleApiError);
  });
});

describe('normalizeForwardGeocode', () => {
  it('returns lat/lng/address from the first OK result', () => {
    const raw = {
      status: 'OK',
      results: [
        { formatted_address: 'Eiffel Tower, Paris', geometry: { location: { lat: 48.8584, lng: 2.2945 } } },
        { formatted_address: 'Paris', geometry: { location: { lat: 48.85, lng: 2.35 } } },
      ],
    };
    expect(normalizeForwardGeocode(raw)).toEqual({
      lat: 48.8584,
      lng: 2.2945,
      address: 'Eiffel Tower, Paris',
    });
  });

  it('returns null on ZERO_RESULTS (no throw)', () => {
    expect(normalizeForwardGeocode({ status: 'ZERO_RESULTS', results: [] })).toBeNull();
  });

  it('returns null when the top result has no usable coordinates', () => {
    expect(normalizeForwardGeocode({ status: 'OK', results: [{ formatted_address: 'x' }] })).toBeNull();
  });

  it('throws GoogleApiError on REQUEST_DENIED', () => {
    expect(() => normalizeForwardGeocode({ status: 'REQUEST_DENIED' })).toThrow(GoogleApiError);
  });
});

describe('normalizeAutocomplete', () => {
  it('maps predictions to {placeId, description}', () => {
    const raw = {
      status: 'OK',
      predictions: [
        { place_id: 'p1', description: 'Senso-ji Temple, Tokyo' },
        { place_id: 'p2', description: 'Tokyo Skytree' },
      ],
    };
    expect(normalizeAutocomplete(raw)).toEqual([
      { placeId: 'p1', description: 'Senso-ji Temple, Tokyo' },
      { placeId: 'p2', description: 'Tokyo Skytree' },
    ]);
  });

  it('returns an empty array for ZERO_RESULTS', () => {
    expect(normalizeAutocomplete({ status: 'ZERO_RESULTS', predictions: [] })).toEqual([]);
  });

  it('drops malformed predictions missing place_id or description', () => {
    const raw = { status: 'OK', predictions: [{ description: 'no id' }, { place_id: 'p1', description: 'ok' }] };
    expect(normalizeAutocomplete(raw)).toEqual([{ placeId: 'p1', description: 'ok' }]);
  });

  it('throws GoogleApiError on a non-OK status', () => {
    expect(() => normalizeAutocomplete({ status: 'REQUEST_DENIED' })).toThrow(GoogleApiError);
  });
});

describe('normalizeDirections', () => {
  it('extracts duration/distance seconds+meters and the overview polyline', () => {
    const raw = {
      status: 'OK',
      routes: [
        {
          overview_polyline: { points: 'abc123_polyline' },
          legs: [{ duration: { value: 642 }, distance: { value: 815 } }],
        },
      ],
    };
    expect(normalizeDirections(raw)).toEqual({
      durationSeconds: 642,
      distanceMeters: 815,
      polyline: 'abc123_polyline',
    });
  });

  it('sums multiple legs (waypoint splits) into a single duration/distance', () => {
    const raw = {
      status: 'OK',
      routes: [
        {
          overview_polyline: { points: 'poly' },
          legs: [
            { duration: { value: 100 }, distance: { value: 200 } },
            { duration: { value: 50 }, distance: { value: 75 } },
          ],
        },
      ],
    };
    expect(normalizeDirections(raw)).toMatchObject({ durationSeconds: 150, distanceMeters: 275 });
  });

  it('throws GoogleApiError on ZERO_RESULTS for directions', () => {
    expect(() => normalizeDirections({ status: 'ZERO_RESULTS', routes: [] })).toThrow(GoogleApiError);
  });
});

describe('fetch wrappers (injected fetch, no real key)', () => {
  const okJson = (body: unknown) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('fetchPlaceDetails calls the details endpoint with key + place_id and returns normalized data', async () => {
    fetchSpy.mockReturnValueOnce(
      okJson({
        status: 'OK',
        result: {
          place_id: 'gpid-1',
          name: 'Senso-ji Temple',
          formatted_address: 'Asakusa',
          geometry: { location: { lat: 1, lng: 2 } },
          types: ['tourist_attraction'],
          photos: [{ photo_reference: 'R' }],
        },
      }),
    );
    const out = await fetchPlaceDetails({ placeId: 'gpid-1', sessionToken: 'sess-1', apiKey: 'SERVER_KEY' });
    expect(out.googlePlaceId).toBe('gpid-1');
    expect(out.categoryGuess).toBe('sightseeing');

    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/place/details/json');
    expect(url.searchParams.get('place_id')).toBe('gpid-1');
    expect(url.searchParams.get('key')).toBe('SERVER_KEY');
    expect(url.searchParams.get('sessiontoken')).toBe('sess-1');
    expect(url.searchParams.get('fields')).toContain('place_id');
  });

  it('fetchPlaceAutocomplete calls the autocomplete endpoint with input + key + sessiontoken', async () => {
    fetchSpy.mockReturnValueOnce(
      okJson({ status: 'OK', predictions: [{ place_id: 'p1', description: 'Senso-ji Temple, Tokyo' }] }),
    );
    const out = await fetchPlaceAutocomplete({ input: 'senso', sessionToken: 'sess-1', apiKey: 'SERVER_KEY' });
    expect(out).toEqual([{ placeId: 'p1', description: 'Senso-ji Temple, Tokyo' }]);

    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    expect(url.searchParams.get('input')).toBe('senso');
    expect(url.searchParams.get('key')).toBe('SERVER_KEY');
    expect(url.searchParams.get('sessiontoken')).toBe('sess-1');
  });

  it('fetchReverseGeocode calls the geocode endpoint with latlng + key', async () => {
    fetchSpy.mockReturnValueOnce(
      okJson({ status: 'OK', results: [{ formatted_address: 'Somewhere' }] }),
    );
    const out = await fetchReverseGeocode({ lat: 35.1, lng: 139.2, apiKey: 'SERVER_KEY' });
    expect(out.address).toBe('Somewhere');

    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
    expect(url.searchParams.get('latlng')).toBe('35.1,139.2');
    expect(url.searchParams.get('key')).toBe('SERVER_KEY');
  });

  it('fetchForwardGeocode calls the geocode endpoint with address + key', async () => {
    fetchSpy.mockReturnValueOnce(
      okJson({ status: 'OK', results: [{ formatted_address: 'Paris, France', geometry: { location: { lat: 48.85, lng: 2.35 } } }] }),
    );
    const out = await fetchForwardGeocode({ address: '12 Rue de Rivoli, Paris', apiKey: 'SERVER_KEY' });
    expect(out).toEqual({ lat: 48.85, lng: 2.35, address: 'Paris, France' });

    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
    expect(url.searchParams.get('address')).toBe('12 Rue de Rivoli, Paris');
    expect(url.searchParams.get('key')).toBe('SERVER_KEY');
  });

  it('fetchForwardGeocode returns null on ZERO_RESULTS', async () => {
    fetchSpy.mockReturnValueOnce(okJson({ status: 'ZERO_RESULTS', results: [] }));
    expect(await fetchForwardGeocode({ address: 'nowhere', apiKey: 'SERVER_KEY' })).toBeNull();
  });

  it('fetchDirections maps walk→walking, passes ordered waypoints, returns normalized data', async () => {
    fetchSpy.mockReturnValueOnce(
      okJson({
        status: 'OK',
        routes: [{ overview_polyline: { points: 'P' }, legs: [{ duration: { value: 60 }, distance: { value: 90 } }] }],
      }),
    );
    const out = await fetchDirections({
      origin: { lat: 1, lng: 2 },
      destination: { lat: 5, lng: 6 },
      waypoints: [{ lat: 3, lng: 4 }],
      mode: 'walk',
      apiKey: 'SERVER_KEY',
    });
    expect(out).toEqual({ durationSeconds: 60, distanceMeters: 90, polyline: 'P' });

    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/directions/json');
    expect(url.searchParams.get('origin')).toBe('1,2');
    expect(url.searchParams.get('destination')).toBe('5,6');
    expect(url.searchParams.get('waypoints')).toBe('3,4');
    expect(url.searchParams.get('mode')).toBe('walking');
    expect(url.searchParams.get('key')).toBe('SERVER_KEY');
  });

  it('throws GoogleApiError when the HTTP response is not ok', async () => {
    fetchSpy.mockReturnValueOnce(Promise.resolve({ ok: false, status: 502 } as Response));
    await expect(
      fetchReverseGeocode({ lat: 1, lng: 2, apiKey: 'K' }),
    ).rejects.toBeInstanceOf(GoogleApiError);
  });
});
