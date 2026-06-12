import { NextResponse } from 'next/server';
import { env } from '@/src/env';
import { fetchPlaceAutocomplete } from '@/src/lib/google/server';
import { getPrincipal } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

/**
 * Places Autocomplete proxy. Runs server-side with the server key so suggestions
 * work even when the browser Maps-JS key is unavailable. `sessionToken` (a UUID
 * from the client) is forwarded so Google bundles these predictions with the
 * eventual Place Details call into one billing session. Degrades to an empty
 * list (never 5xx) so the address field stays usable if Google is unreachable.
 */
export async function GET(req: Request) {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const input = url.searchParams.get('input')?.trim();
  const sessionToken = url.searchParams.get('sessionToken') ?? undefined;

  if (!input || !env.GOOGLE_MAPS_SERVER_KEY) {
    return NextResponse.json({ predictions: [] });
  }

  try {
    const predictions = await fetchPlaceAutocomplete({
      input,
      sessionToken,
      apiKey: env.GOOGLE_MAPS_SERVER_KEY,
    });
    return NextResponse.json({ predictions });
  } catch {
    return NextResponse.json({ predictions: [] });
  }
}
