import { NextResponse } from 'next/server';
import { env } from '@/src/env';
import { fetchReverseGeocode } from '@/src/lib/google/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
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
