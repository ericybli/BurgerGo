import { NextResponse } from 'next/server';
import { env } from '@/src/env';
import { fetchPoiDetailsRich } from '@/src/lib/google/server';

export const dynamic = 'force-dynamic';

/**
 * Rich Place Details for a tapped basemap POI (map card): name, address,
 * rating + count, open-now + weekday hours, editorial summary, up to 6 photo
 * references (served via /api/google/poi-photo), and top reviews.
 *
 * Live call on every tap (user-initiated; no DB cache — the rich fields go
 * stale quickly and the existing place_details_cache schema only holds the
 * basic tier). The server key never reaches the client.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get('placeId');
  if (!placeId) {
    return NextResponse.json({ error: 'missing_placeId' }, { status: 400 });
  }
  if (!env.GOOGLE_MAPS_SERVER_KEY) {
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }
  try {
    const details = await fetchPoiDetailsRich({
      placeId,
      apiKey: env.GOOGLE_MAPS_SERVER_KEY,
    });
    return NextResponse.json(details);
  } catch {
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }
}
