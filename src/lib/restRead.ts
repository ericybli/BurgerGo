import { NextResponse } from 'next/server';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';

/**
 * Shared wrapper for REST read routes: requires a principal (session or
 * x-api-key machine bypass), optionally checks trip membership (404 on
 * non-member, so trip existence can't be probed), and returns the handler's
 * payload as JSON. Thrown "… not found" errors map to 404, anything else 400.
 */
export async function restRead(
  req: Request,
  tripId: string | null,
  handler: () => unknown | Promise<unknown>,
): Promise<Response> {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    if (tripId) requireTripMember(principal, tripId);
    return NextResponse.json(await handler());
  } catch (err) {
    const message = (err as Error)?.message ?? 'invalid';
    const notFound = /not found/i.test(message);
    return NextResponse.json(
      { error: notFound ? 'not_found' : 'invalid_input', message },
      { status: notFound ? 404 : 400 },
    );
  }
}
