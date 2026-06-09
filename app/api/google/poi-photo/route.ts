import { NextResponse } from 'next/server';
import { env } from '@/src/env';

export const dynamic = 'force-dynamic';

const PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';

/** photo_reference charset guard (opaque Google token). */
const REF_RE = /^[A-Za-z0-9_=\-./+]{10,2000}$/;

/**
 * Streams a Google Place photo for the POI card's swipeable gallery. The
 * upstream host is FIXED (maps.googleapis.com) and `ref` is validated, so this
 * is not an open proxy; the server key never reaches the client. Long client
 * cache — photo bytes for a given reference are immutable in practice.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get('ref') ?? '';
  const w = Math.min(1600, Math.max(200, Number(url.searchParams.get('w')) || 800));
  if (!REF_RE.test(ref)) {
    return NextResponse.json({ error: 'bad_ref' }, { status: 400 });
  }
  if (!env.GOOGLE_MAPS_SERVER_KEY) {
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }
  try {
    const params = new URLSearchParams({
      photo_reference: ref,
      maxwidth: String(w),
      key: env.GOOGLE_MAPS_SERVER_KEY,
    });
    // Google answers with a redirect to the image host; fetch follows it.
    const res = await fetch(`${PHOTO_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
    }
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }
}
