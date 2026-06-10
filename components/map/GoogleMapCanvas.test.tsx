import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceMarker } from '@/src/lib/map/markers';
import type { DayPath } from '@/src/lib/map/types';

// ---- Fake google.maps captured per render --------------------------------
type FakeCapture = {
  markers: any[];
  polylines: any[];
  fitBoundsCalls: any[];
  mapInstances: any[];
};
let captured: FakeCapture;

function makeFakeGoogle() {
  captured = { markers: [], polylines: [], fitBoundsCalls: [], mapInstances: [] };
  return {
    Map: vi.fn(function (this: any, _el: HTMLElement) {
      this.__el = _el;
      this.setCenter = (_c: unknown) => {};
      this.fitBounds = (b: unknown) => captured.fitBoundsCalls.push(b);
      this.listeners = {} as Record<string, (e?: unknown) => void>;
      this.addListener = (ev: string, cb: (e?: unknown) => void) => {
        this.listeners[ev] = cb;
      };
      this.setOptions = vi.fn();
      captured.mapInstances.push(this);
    }),
    // Custom-DOM pin host: setMap(map) attaches (onAdd + draw), setMap(null)
    // detaches (onRemove). Panes live INSIDE the map's container so pins are
    // removed with the component on unmount (no cross-test DOM leaks).
    OverlayView: vi.fn(function (this: any) {
      this.getPanes = () => ({ overlayMouseTarget: this.__map?.__el ?? document.body });
      this.getProjection = () => ({ fromLatLngToDivPixel: () => ({ x: 0, y: 0 }) });
      this.setMap = (m: any) => {
        if (m) {
          this.__map = m;
          this.onAdd?.();
          this.draw?.();
        } else {
          this.onRemove?.();
        }
      };
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
      this.listeners = {} as Record<string, () => void>;
      this.addListener = (ev: string, cb: () => void) => {
        this.listeners[ev] = cb;
      };
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

function renderCanvas(
  props: React.ComponentProps<typeof GoogleMapCanvas>,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <GoogleMapCanvas {...props} />
    </NextIntlClientProvider>,
  );
}

const MARKERS: PlaceMarker[] = [
  {
    id: 'a', name: 'Senso-ji', category: 'sightseeing', googlePlaceId: 'ga',
    photoPath: null, position: { lat: 35.0, lng: 139.0 }, label: '1', color: '#EE5B3C', glyph: '🏛️', scheduledTime: null,
  },
  {
    id: 'b', name: 'Skytree', category: 'activity', googlePlaceId: 'gb',
    photoPath: null, position: { lat: 35.1, lng: 139.1 }, label: '2', color: '#EE5B3C', glyph: '🎟️', scheduledTime: null,
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
    renderCanvas({ markers: MARKERS, paths: PATHS, onMarkerClick: vi.fn() });
    await waitFor(() => expect(mockLoadGoogleMaps).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('google-map-canvas')).toBeInTheDocument();
  });

  it('renders one DOM pin per entry with glyph, stop-number badge, and time chip', async () => {
    const timed: PlaceMarker[] = [
      { ...MARKERS[0]!, scheduledTime: '12:00' },
      MARKERS[1]!,
    ];
    renderCanvas({ markers: timed, paths: PATHS, onMarkerClick: vi.fn() });
    const pinA = await screen.findByRole('button', { name: 'Senso-ji' });
    const pinB = await screen.findByRole('button', { name: 'Skytree' });
    // Category glyph + the 1-based stop number badge render inside the pin.
    expect(pinA.textContent).toContain('🏛️');
    expect(pinA.textContent).toContain('1');
    expect(pinB.textContent).toContain('🎟️');
    expect(pinB.textContent).toContain('2');
    // Scheduled stop carries its HH:MM time chip; unscheduled does not.
    expect(pinA.textContent).toContain('12:00');
    expect(pinB.textContent).not.toContain(':');
  });

  it('creates a colored polyline per day path', async () => {
    renderCanvas({ markers: MARKERS, paths: PATHS, onMarkerClick: vi.fn() });
    await waitFor(() => expect(captured.polylines).toHaveLength(1));
    expect(captured.polylines[0].opts.strokeColor).toBe('#EE5B3C');
    expect(captured.polylines[0].opts.path).toEqual([
      { lat: 35.0, lng: 139.0 },
      { lat: 35.1, lng: 139.1 },
    ]);
  });

  it('labels Saved pins (label null) with the category glyph and no badge/time', async () => {
    const savedMarkers: PlaceMarker[] = [
      { id: 's', name: 'Wish', category: 'other', googlePlaceId: null,
        photoPath: null, position: { lat: 35.5, lng: 139.5 }, label: null, color: null, glyph: '📍', scheduledTime: null },
    ];
    renderCanvas({ markers: savedMarkers, paths: [], onMarkerClick: vi.fn() });
    const pin = await screen.findByRole('button', { name: 'Wish' });
    expect(pin.textContent).toBe('📍');
  });

  it('calls fitBounds with the marker extent', async () => {
    renderCanvas({ markers: MARKERS, paths: PATHS, onMarkerClick: vi.fn() });
    await waitFor(() => expect(captured.fitBoundsCalls).toHaveLength(1));
  });

  it('forwards a marker tap with the place id to onMarkerClick', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onMarkerClick = vi.fn();
    renderCanvas({ markers: MARKERS, paths: PATHS, onMarkerClick });
    const pin = await screen.findByRole('button', { name: 'Senso-ji' });
    await userEvent.click(pin);
    expect(onMarkerClick).toHaveBeenCalledWith('a');
  });

  it('renders the container but creates no markers when the loader rejects', async () => {
    mockLoadGoogleMaps.mockRejectedValue(new Error('no key'));
    renderCanvas({ markers: MARKERS, paths: PATHS, onMarkerClick: vi.fn() });
    await waitFor(() => expect(mockLoadGoogleMaps).toHaveBeenCalled());
    // Container still visible; pins were never created.
    expect(screen.getByTestId('google-map-canvas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Senso-ji' })).not.toBeInTheDocument();
  });

  it('routes a tap on a leg-carrying segment to onLegClick (via the wide hit line)', async () => {
    const seg: DayPath = {
      date: '2026-06-04', color: '#EE5B3C',
      path: [{ lat: 35.0, lng: 139.0 }, { lat: 35.1, lng: 139.1 }],
      seg: { fromName: 'Senso-ji', toName: 'Skytree', mode: 'drive', leg: null },
    };
    const onLegClick = vi.fn();
    renderCanvas({ markers: MARKERS, paths: [seg], onMarkerClick: vi.fn(), onLegClick });
    // Visible line + invisible 16px hit line for the seg-carrying path.
    await waitFor(() => expect(captured.polylines).toHaveLength(2));
    const hit = captured.polylines.find((pl: any) => pl.opts.strokeWeight === 16);
    expect(hit).toBeTruthy();
    hit.listeners['click']!();
    expect(onLegClick).toHaveBeenCalledWith(seg);
  });

  it('routes basemap POI taps to onPoiClick only while the POI toggle is on', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onPoiClick = vi.fn();
    renderCanvas({ markers: MARKERS, paths: PATHS, onMarkerClick: vi.fn(), onPoiClick });
    await waitFor(() => expect(captured.mapInstances).toHaveLength(1));
    const map = captured.mapInstances[0];
    await waitFor(() => expect(map.listeners['click']).toBeTruthy());

    // Toggle off (default): POI clicks are ignored.
    const stop = vi.fn();
    map.listeners['click']({ placeId: 'poi-1', stop });
    expect(onPoiClick).not.toHaveBeenCalled();

    // Toggle on: clickableIcons enabled, POI click forwarded + default UI stopped.
    await userEvent.click(screen.getByRole('button', { name: en.planMap.poiToggle }));
    expect(map.setOptions).toHaveBeenCalledWith({ clickableIcons: true });
    map.listeners['click']({ placeId: 'poi-1', stop });
    expect(onPoiClick).toHaveBeenCalledWith('poi-1');
    expect(stop).toHaveBeenCalled();

    // Map clicks without a placeId (plain ground taps) are never forwarded.
    map.listeners['click']({});
    expect(onPoiClick).toHaveBeenCalledTimes(1);
  });
});
