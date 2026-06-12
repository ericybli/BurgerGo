import { NextResponse } from 'next/server';
import { env } from '@/src/env';
import { fetchReverseGeocode, fetchForwardGeocode } from '@/src/lib/google/server';
import { getPrincipal } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

/**
 * Geocode proxy (server key, cache-gated by Google's own results upstream).
 * - Forward: `?address=<text>` → `{ lat, lng, address }` (nulls when no match).
 * - Reverse: `?lat=&lng=`      → `{ address }`.
 * Forward takes precedence when an `address` param is present.
 */
export async function GET(req: Request) {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const address = url.searchParams.get('address');

  // --- Forward geocode (address → coords) ----------------------------------
  if (address !== null) {
    const trimmed = address.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'missing_address' }, { status: 400 });
    }
    if (!env.GOOGLE_MAPS_SERVER_KEY) {
      return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
    }
    try {
      const out = await fetchForwardGeocode({ address: trimmed, apiKey: env.GOOGLE_MAPS_SERVER_KEY });
      // Normalize a no-match to explicit nulls so the client can detect it.
      return NextResponse.json(out ?? { lat: null, lng: null, address: null, googlePlaceId: null });
    } catch {
      return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
    }
  }

  // --- Reverse geocode (coords → address) ----------------------------------
  const rawLat = url.searchParams.get('lat');
  const rawLng = url.searchParams.get('lng');
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  // Reject missing params, empty strings (Number('') === 0 but is logically
  // absent), and non-finite values (NaN / Infinity from non-numeric strings).
  if (!rawLat || !rawLng || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'missing_latlng' }, { status: 400 });
  }
  if (!env.GOOGLE_MAPS_SERVER_KEY) {
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }
  try {
    const out = await fetchReverseGeocode({ lat, lng, apiKey: env.GOOGLE_MAPS_SERVER_KEY });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }
}
