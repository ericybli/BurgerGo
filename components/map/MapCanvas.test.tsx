import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/map/GoogleMapCanvas', () => ({
  GoogleMapCanvas: () => <div data-testid="google-canvas" />,
}));
vi.mock('@/components/map/MapboxCanvas', () => ({
  MapboxCanvas: () => <div data-testid="mapbox-canvas" />,
}));

const noop = () => {};
const props = { markers: [], paths: [], onMarkerClick: noop };

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/src/lib/map/provider');
});

describe('MapCanvas provider selection', () => {
  it('renders GoogleMapCanvas when the provider is google', async () => {
    vi.resetModules();
    vi.doMock('@/src/lib/map/provider', () => ({ MAP_PROVIDER: 'google', MAPBOX_TOKEN: '' }));
    const { MapCanvas } = await import('@/components/map/MapCanvas');
    render(<MapCanvas {...props} />);
    expect(screen.getByTestId('google-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('mapbox-canvas')).not.toBeInTheDocument();
  });

  it('renders MapboxCanvas when the provider is mapbox', async () => {
    vi.resetModules();
    vi.doMock('@/src/lib/map/provider', () => ({ MAP_PROVIDER: 'mapbox', MAPBOX_TOKEN: 'pk.t' }));
    const { MapCanvas } = await import('@/components/map/MapCanvas');
    render(<MapCanvas {...props} />);
    expect(screen.getByTestId('mapbox-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('google-canvas')).not.toBeInTheDocument();
  });
});
