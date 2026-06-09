import { describe, it, expect } from 'vitest';
import { placeUrl, dayRouteUrl } from '@/src/lib/googleMapsUrl';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

describe('placeUrl', () => {
  it('uses query + query_place_id when a googlePlaceId is present', () => {
    const url = placeUrl({
      name: 'Senso-ji Temple',
      lat: 35.714765,
      lng: 139.796655,
      googlePlaceId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw',
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
    expect(u.searchParams.get('api')).toBe('1');
    expect(u.searchParams.get('query')).toBe('Senso-ji Temple');
    expect(u.searchParams.get('query_place_id')).toBe('ChIJ8T1GpMGOGGARDYGSgpooDWw');
  });

  it('searches by "name, address" when googlePlaceId is null but both are present', () => {
    const url = placeUrl({
      name: 'Senso-ji Temple',
      address: '2-3-1 Asakusa, Taito City',
      lat: 35.714765,
      lng: 139.796655,
      googlePlaceId: null,
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
    expect(u.searchParams.get('query')).toBe('Senso-ji Temple, 2-3-1 Asakusa, Taito City');
    expect(u.searchParams.has('query_place_id')).toBe(false);
  });

  it('searches by name alone when there is no place id and no address', () => {
    const url = placeUrl({ name: 'Senso-ji Temple', lat: 35.714765, lng: 139.796655, googlePlaceId: null });
    expect(new URL(url).searchParams.get('query')).toBe('Senso-ji Temple');
  });

  it('falls back to coordinates only for a truly nameless pin', () => {
    const url = placeUrl({ name: '', lat: 1, lng: 2 });
    expect(new URL(url).searchParams.get('query')).toBe('1,2');
  });
});

describe('dayRouteUrl', () => {
  const places = [
    { lat: 35.6586, lng: 139.7454 },
    { lat: 35.6595, lng: 139.7005 },
    { lat: 35.6764, lng: 139.6993 },
    { lat: 35.7148, lng: 139.7967 },
  ];

  it('builds an origin/destination/waypoints directions URL with mapped mode', () => {
    const url = dayRouteUrl(places, 'transit');
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('api')).toBe('1');
    expect(u.searchParams.get('origin')).toBe('35.6586,139.7454');
    expect(u.searchParams.get('destination')).toBe('35.7148,139.7967');
    expect(u.searchParams.get('waypoints')).toBe('35.6595,139.7005|35.6764,139.6993');
    expect(u.searchParams.get('travelmode')).toBe('transit');
    // No place ids → no *_place_id params.
    expect(u.searchParams.has('origin_place_id')).toBe(false);
    expect(u.searchParams.has('waypoint_place_ids')).toBe(false);
  });

  it('passes real Google places (names + place ids) when stops carry them', () => {
    const stops = [
      { lat: 1, lng: 2, name: 'KOA Airport', googlePlaceId: 'pid-a' },
      { lat: 3, lng: 4, name: 'Kua Bay', googlePlaceId: 'pid-b' },
      { lat: 5, lng: 6, name: 'Kona Airbnb', googlePlaceId: 'pid-c' },
    ];
    const u = new URL(dayRouteUrl(stops, 'drive'));
    expect(u.searchParams.get('origin')).toBe('KOA Airport');
    expect(u.searchParams.get('origin_place_id')).toBe('pid-a');
    expect(u.searchParams.get('destination')).toBe('Kona Airbnb');
    expect(u.searchParams.get('destination_place_id')).toBe('pid-c');
    expect(u.searchParams.get('waypoints')).toBe('Kua Bay');
    expect(u.searchParams.get('waypoint_place_ids')).toBe('pid-b');
  });

  it('falls back to coordinates for intermediates when not ALL of them have place ids', () => {
    const stops = [
      { lat: 1, lng: 2, name: 'KOA Airport', googlePlaceId: 'pid-a' },
      { lat: 3, lng: 4, name: 'Dropped pin', googlePlaceId: null },
      { lat: 5, lng: 6, name: 'Kua Bay', googlePlaceId: 'pid-b' },
      { lat: 7, lng: 8, name: 'Kona Airbnb', googlePlaceId: 'pid-c' },
    ];
    const u = new URL(dayRouteUrl(stops, 'drive'));
    // waypoint_place_ids must correspond 1:1 — mixed ids → coords + no id list.
    expect(u.searchParams.get('waypoints')).toBe('3,4|5,6');
    expect(u.searchParams.has('waypoint_place_ids')).toBe(false);
    // Origin/destination ids are independent and still sent.
    expect(u.searchParams.get('origin_place_id')).toBe('pid-a');
    expect(u.searchParams.get('destination_place_id')).toBe('pid-c');
  });

  it('maps walk → walking and drive → driving', () => {
    expect(new URL(dayRouteUrl(places, 'walk')).searchParams.get('travelmode')).toBe('walking');
    expect(new URL(dayRouteUrl(places, 'drive')).searchParams.get('travelmode')).toBe('driving');
  });

  it('omits waypoints for a 2-stop day', () => {
    const url = dayRouteUrl([places[0]!, places[3]!], 'drive');
    const u = new URL(url);
    expect(u.searchParams.get('origin')).toBe('35.6586,139.7454');
    expect(u.searchParams.get('destination')).toBe('35.7148,139.7967');
    expect(u.searchParams.has('waypoints')).toBe(false);
  });

  it('for a single stop, origin equals destination and no waypoints', () => {
    const u = new URL(dayRouteUrl([places[0]!], 'walk'));
    expect(u.searchParams.get('origin')).toBe('35.6586,139.7454');
    expect(u.searchParams.get('destination')).toBe('35.6586,139.7454');
    expect(u.searchParams.has('waypoints')).toBe(false);
  });

  it('throws when given no stops', () => {
    expect(() => dayRouteUrl([], 'walk' as TravelMode)).toThrow();
  });
});
