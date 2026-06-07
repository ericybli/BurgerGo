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
};

vi.mock('@/src/lib/mapbox/loader', () => ({
  loadMapbox: () => Promise.resolve(fakeMapbox),
  __resetMapboxLoaderForTests: () => {},
}));
vi.mock('@/src/lib/map/provider', () => ({ MAP_PROVIDER: 'mapbox', MAPBOX_TOKEN: 'pk.test' }));

import { MapboxCanvas } from '@/components/map/MapboxCanvas';
import type { PlaceMarker } from '@/src/lib/map/markers';

const markers: PlaceMarker[] = [
  { id: 'a', name: 'A', position: { lat: 1, lng: 2 }, label: '1', color: '#ee5b3c', category: 'sightseeing', googlePlaceId: null, photoPath: null, glyph: '🏛️' },
  { id: 'b', name: 'B', position: { lat: 3, lng: 4 }, label: '2', color: '#4f8a86', category: 'lodging', googlePlaceId: null, photoPath: null, glyph: '🛏️' },
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

  it('invokes onMarkerClick when a marker element is clicked', async () => {
    const onClick = vi.fn();
    renderCanvas(onClick);
    await fireMapLoad();
    await waitFor(() => expect(fakeMapbox.Marker).toHaveBeenCalled());
    // The marker element is the first arg to the Marker ctor ({ element }).
    const firstCall = fakeMapbox.Marker.mock.calls[0]![0];
    firstCall.element.click();
    expect(onClick).toHaveBeenCalledWith('a');
  });

  it('toggles the base style via the compact Map/Satellite button', async () => {
    renderCanvas();
    await fireMapLoad();
    const btn = screen.getByRole('button', { name: en.planMap.toggleMapStyle });
    fireEvent.click(btn);
    expect(fakeMap.setStyle).toHaveBeenCalledTimes(1);
  });
});
