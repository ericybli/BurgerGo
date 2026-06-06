import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { PlaceMarker } from '@/src/lib/map/markers';
import type { DayPath } from '@/src/lib/map/types';

// ---- Fake google.maps captured per render --------------------------------
type FakeCapture = {
  markers: any[];
  polylines: any[];
  fitBoundsCalls: any[];
};
let captured: FakeCapture;

function makeFakeGoogle() {
  captured = { markers: [], polylines: [], fitBoundsCalls: [] };
  return {
    Map: vi.fn(function (this: any, _el: HTMLElement) {
      this.fitBounds = (b: unknown) => captured.fitBoundsCalls.push(b);
    }),
    Marker: vi.fn(function (this: any, opts: any) {
      this.opts = opts;
      this.listeners = {} as Record<string, () => void>;
      this.addListener = (ev: string, cb: () => void) => {
        this.listeners[ev] = cb;
      };
      captured.markers.push(this);
    }),
    Polyline: vi.fn(function (this: any, opts: any) {
      this.opts = opts;
      captured.polylines.push(this);
    }),
    LatLngBounds: vi.fn(function (this: any) {}),
    LatLng: vi.fn(function (this: any, lat: number, lng: number) {
      this.lat = lat; this.lng = lng;
    }),
    SymbolPath: { CIRCLE: 0 },
  };
}

// Mock B0's loader — no real API key in tests.
const mockLoadGoogleMaps = vi.fn();
vi.mock('@/src/lib/googleLoader', () => ({
  loadGoogleMaps: () => mockLoadGoogleMaps(),
}));

import { GoogleMapCanvas } from './GoogleMapCanvas';

const MARKERS: PlaceMarker[] = [
  {
    id: 'a', name: 'Senso-ji', category: 'sightseeing', googlePlaceId: 'ga',
    photoPath: null, position: { lat: 35.0, lng: 139.0 }, label: '1', color: '#EE5B3C',
  },
  {
    id: 'b', name: 'Skytree', category: 'activity', googlePlaceId: 'gb',
    photoPath: null, position: { lat: 35.1, lng: 139.1 }, label: '2', color: '#EE5B3C',
  },
];
const PATHS: DayPath[] = [
  { date: '2026-06-04', color: '#EE5B3C',
    path: [{ lat: 35.0, lng: 139.0 }, { lat: 35.1, lng: 139.1 }] },
];

beforeEach(() => {
  mockLoadGoogleMaps.mockReset();
  mockLoadGoogleMaps.mockResolvedValue(makeFakeGoogle());
});
afterEach(() => vi.clearAllMocks());

describe('GoogleMapCanvas', () => {
  it('loads the Maps API and renders the map container', async () => {
    render(
      <GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />,
    );
    await waitFor(() => expect(mockLoadGoogleMaps).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('google-map-canvas')).toBeInTheDocument();
  });

  it('creates one marker per entry with correct position and numbered label', async () => {
    render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
    await waitFor(() => expect(captured.markers).toHaveLength(2));
    expect(captured.markers[0].opts.position).toEqual({ lat: 35.0, lng: 139.0 });
    expect(captured.markers[0].opts.label.text).toBe('1');
    expect(captured.markers[1].opts.label.text).toBe('2');
  });

  it('creates a colored polyline per day path', async () => {
    render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
    await waitFor(() => expect(captured.polylines).toHaveLength(1));
    expect(captured.polylines[0].opts.strokeColor).toBe('#EE5B3C');
    expect(captured.polylines[0].opts.path).toEqual([
      { lat: 35.0, lng: 139.0 },
      { lat: 35.1, lng: 139.1 },
    ]);
  });

  it('creates un-labeled, un-numbered markers when label is null (Saved pins)', async () => {
    const savedMarkers: PlaceMarker[] = [
      { id: 's', name: 'Wish', category: 'other', googlePlaceId: null,
        photoPath: null, position: { lat: 35.5, lng: 139.5 }, label: null, color: null },
    ];
    render(<GoogleMapCanvas markers={savedMarkers} paths={[]} onMarkerClick={vi.fn()} />);
    await waitFor(() => expect(captured.markers).toHaveLength(1));
    expect(captured.markers[0].opts.label).toBeUndefined();
  });

  it('calls fitBounds with the marker extent', async () => {
    render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
    await waitFor(() => expect(captured.fitBoundsCalls).toHaveLength(1));
  });

  it('forwards a marker tap with the place id to onMarkerClick', async () => {
    const onMarkerClick = vi.fn();
    render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={onMarkerClick} />);
    await waitFor(() => expect(captured.markers).toHaveLength(2));
    captured.markers[0].listeners['click']!();
    expect(onMarkerClick).toHaveBeenCalledWith('a');
  });

  it('renders the container but creates no markers when the loader rejects', async () => {
    mockLoadGoogleMaps.mockRejectedValue(new Error('no key'));
    render(<GoogleMapCanvas markers={MARKERS} paths={PATHS} onMarkerClick={vi.fn()} />);
    await waitFor(() => expect(mockLoadGoogleMaps).toHaveBeenCalled());
    // Container still visible; markers were never created.
    expect(screen.getByTestId('google-map-canvas')).toBeInTheDocument();
    expect(captured.markers).toHaveLength(0);
  });
});
