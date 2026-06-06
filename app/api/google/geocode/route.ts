import { NextResponse } from 'next/server';
import { env } from '@/src/env';
import { fetchReverseGeocode } from '@/src/lib/google/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      url.searchParams.get('lat') === null || url.searchParams.get('lng') === null) {
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
