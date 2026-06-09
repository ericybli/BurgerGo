import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// A fake mapbox-gl that records calls — no WebGL/real module in jsdom.
type Handler = () => void;
const fakeMap = {
  handlers: {} as Record<string, Handler>,
  on: vi.fn((evt: string, cb: Handler) => {
    fakeMap.handlers[evt] = cb;
  }),
  off: vi.fn((evt: string) => {
    delete fakeMap.handlers[evt];
  }),
  once: vi.fn((evt: string, cb: Handler) => {
    fakeMap.handlers[`once:${evt}`] = cb;
  }),
  addControl: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getLayer: vi.fn(() => undefined),
  getSource: vi.fn(() => undefined),
  removeLayer: vi.fn(),
  removeSource: vi.fn(),
  fitBounds: vi.fn(),
  // Clustering reads the viewport: a world bbox + a mid zoom so the two
  // far-apart test pins stay unclustered (one Marker each).
  getBounds: vi.fn(() => ({ getWest: () => -180, getSouth: () => -85, getEast: () => 180, getNorth: () => 85 })),
  getZoom: vi.fn(() => 10),
  easeTo: vi.fn(),
  setStyle: vi.fn(),
  resize: vi.fn(),
  remove: vi.fn(),
};
function makeMarker() {
  const inst = { setLngLat: vi.fn(() => inst), addTo: vi.fn(() => inst), remove: vi.fn() };
  return inst;
}
const fakeMapbox = {
  accessToken: '',
  Map: vi.fn(() => fakeMap),
  Marker: vi.fn((_opts: { element: HTMLElement; anchor?: string }) => makeMarker()),
  NavigationControl: vi.fn(),
  GeolocateControl: vi.fn(),
};

vi.mock('@/src/lib/mapbox/loader', () => ({
  loadMapbox: () => Promise.resolve(fakeMapbox),
  __resetMapboxLoaderForTests: () => {},
}));
vi.mock('@/src/lib/map/provider', () => ({ MAP_PROVIDER: 'mapbox', MAPBOX_TOKEN: 'pk.test' }));

import { MapboxCanvas } from '@/components/map/MapboxCanvas';
import type { PlaceMarker } from '@/src/lib/map/markers';

const markers: PlaceMarker[] = [
  { id: 'a', name: 'A', position: { lat: 1, lng: 2 }, label: '1', color: '#ee5b3c', category: 'sightseeing', googlePlaceId: null, photoPath: null, glyph: '🏛️', scheduledTime: '09:00' },
  { id: 'b', name: 'B', position: { lat: 3, lng: 4 }, label: '2', color: '#4f8a86', category: 'lodging', googlePlaceId: null, photoPath: null, glyph: '🛏️', scheduledTime: null },
];
const paths = [{ date: '2026-06-10', color: '#4f8a86', path: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] }];

function renderCanvas(onClick = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MapboxCanvas markers={markers} paths={paths} onMarkerClick={onClick} />
    </NextIntlClientProvider>,
  );
}

async function fireMapLoad() {
  await waitFor(() => expect(fakeMapbox.Map).toHaveBeenCalled());
  act(() => fakeMap.handlers['load']?.());
}

beforeEach(() => {
  fakeMap.handlers = {};
  fakeMapbox.accessToken = '';
  vi.clearAllMocks();
  fakeMap.getLayer.mockReturnValue(undefined);
  fakeMap.getSource.mockReturnValue(undefined);
});

describe('MapboxCanvas', () => {
  it('creates the map, sets the token, and renders the container', async () => {
    renderCanvas();
    await waitFor(() => expect(fakeMapbox.Map).toHaveBeenCalledTimes(1));
    expect(fakeMapbox.accessToken).toBe('pk.test');
    expect(screen.getByTestId('mapbox-canvas')).toBeInTheDocument();
    // zoom control added.
    expect(fakeMapbox.NavigationControl).toHaveBeenCalled();
    expect(fakeMap.addControl).toHaveBeenCalled();
  });

  it('draws a marker per place, a layer per route, and fits the bounds on load', async () => {
    renderCanvas();
    await fireMapLoad();
    await waitFor(() => expect(fakeMapbox.Marker).toHaveBeenCalledTimes(2));
    expect(fakeMap.addSource).toHaveBeenCalledTimes(1);
    expect(fakeMap.addLayer).toHaveBeenCalledTimes(1);
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('re-fits only when marker positions change — NOT on same-position re-renders (e.g. opening a card)', async () => {
    const wrap = (ms: PlaceMarker[]) => (
      <NextIntlClientProvider locale="en" messages={en}>
        <MapboxCanvas markers={ms} paths={paths} onMarkerClick={vi.fn()} />
      </NextIntlClientProvider>
    );
    const { rerender } = render(wrap(markers));
    await fireMapLoad();
    await waitFor(() => expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1));

    // A parent re-render hands down a fresh array with the SAME positions → no re-fit.
    rerender(wrap(markers.map((m) => ({ ...m }))));
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);

    // A genuinely moved/changed pin set → re-fit.
    rerender(wrap([{ ...markers[0]!, position: { lat: 9, lng: 9 } }, markers[1]!]));
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(2);
  });

  it('invokes onMarkerClick when a leaf marker element is clicked', async () => {
    const onClick = vi.fn();
    renderCanvas(onClick);
    await fireMapLoad();
    await waitFor(() => expect(fakeMapbox.Marker).toHaveBeenCalledTimes(2));
    // Cluster query order isn't guaranteed, so click every rendered leaf.
    for (const call of fakeMapbox.Marker.mock.calls) {
      (call[0].element as HTMLElement).click();
    }
    expect(onClick).toHaveBeenCalledWith('a');
  });

  it('collapses near-coincident pins into one cluster bubble (tap → zoom in)', async () => {
    const close: PlaceMarker[] = [
      { ...markers[0]!, id: 'a', position: { lat: 1, lng: 2 } },
      { ...markers[1]!, id: 'b', position: { lat: 1.001, lng: 2.001 } },
    ];
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MapboxCanvas markers={close} paths={[]} onMarkerClick={vi.fn()} />
      </NextIntlClientProvider>,
    );
    await fireMapLoad();
    // Two overlapping pins → a single count bubble, not two markers.
    await waitFor(() => expect(fakeMapbox.Marker).toHaveBeenCalledTimes(1));
    const el = fakeMapbox.Marker.mock.calls[0]![0].element as HTMLElement;
    expect(el.textContent).toBe('2');
    el.click();
    expect(fakeMap.easeTo).toHaveBeenCalled();
  });

  it('renders every pin flat (no cluster bubble) when cluster={false}', async () => {
    const close: PlaceMarker[] = [
      { ...markers[0]!, id: 'a', position: { lat: 1, lng: 2 } },
      { ...markers[1]!, id: 'b', position: { lat: 1.001, lng: 2.001 } },
    ];
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <MapboxCanvas markers={close} paths={[]} cluster={false} onMarkerClick={vi.fn()} />
      </NextIntlClientProvider>,
    );
    await fireMapLoad();
    // Clustering off → two overlapping pins stay as two separate markers.
    await waitFor(() => expect(fakeMapbox.Marker).toHaveBeenCalledTimes(2));
    for (const call of fakeMapbox.Marker.mock.calls) {
      expect((call[0].element as HTMLElement).textContent).not.toBe('2');
    }
  });

  it('toggles the base style via the compact Map/Satellite button', async () => {
    renderCanvas();
    await fireMapLoad();
    const btn = screen.getByRole('button', { name: en.planMap.toggleMapStyle });
    fireEvent.click(btn);
    expect(fakeMap.setStyle).toHaveBeenCalledTimes(1);
  });
});
