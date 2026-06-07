/**
 * Lazily load the heavy `mapbox-gl` module, client-side and memoized. Kept
 * behind this function (not a static import in the component) so unit tests can
 * `vi.mock` it and never pull WebGL/`mapbox-gl` into jsdom.
 */
let mapboxPromise: Promise<typeof import('mapbox-gl').default> | null = null;

export function loadMapbox(): Promise<typeof import('mapbox-gl').default> {
  if (!mapboxPromise) {
    mapboxPromise = import('mapbox-gl').then((m) => m.default);
  }
  return mapboxPromise;
}

/** Test-only: reset the memoized module promise. */
export function __resetMapboxLoaderForTests(): void {
  mapboxPromise = null;
}
