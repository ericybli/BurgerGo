/**
 * Which map engine the in-app map uses, and the Mapbox public token. Both are
 * read as literal `process.env.NEXT_PUBLIC_*` accesses so Next inlines them into
 * the client bundle at build time (reading via the env module would yield '' in
 * the browser). The Google component is kept; this just selects at build time.
 *
 * Set `NEXT_PUBLIC_MAP_PROVIDER=mapbox` (+ `NEXT_PUBLIC_MAPBOX_TOKEN`) to use
 * Mapbox; anything else (default) uses Google Maps.
 */
export type MapProvider = 'google' | 'mapbox';

export const MAP_PROVIDER: MapProvider =
  process.env.NEXT_PUBLIC_MAP_PROVIDER === 'mapbox' ? 'mapbox' : 'google';

export const MAPBOX_TOKEN: string = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
