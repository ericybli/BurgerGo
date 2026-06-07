/**
 * Client-side Google wrappers (spec §6.1/§6.5). All Google network calls go
 * through the server proxies (/api/google/*) so the server key is never
 * exposed to the browser and all calls are cache-gated.
 */
import { withBase } from '@/src/lib/basePath';

/**
 * Reverse-geocode a lat/lng to a human-readable address via the server proxy.
 * Returns null on a zero-result, network failure, or missing key.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(withBase(`/api/google/geocode?lat=${lat}&lng=${lng}`));
    if (!res.ok) return null;
    const data = (await res.json()) as { address: string | null };
    return data.address;
  } catch {
    return null;
  }
}

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  address: string | null;
}

/**
 * Forward-geocode a free-text address to coordinates via the server proxy.
 * Returns null on no-match, network failure, or missing key — callers save the
 * place without coordinates in that case.
 */
export async function forwardGeocode(address: string): Promise<ForwardGeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(withBase(`/api/google/geocode?address=${encodeURIComponent(trimmed)}`));
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: number | null; lng: number | null; address: string | null };
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    return { lat: data.lat, lng: data.lng, address: data.address };
  } catch {
    return null;
  }
}
