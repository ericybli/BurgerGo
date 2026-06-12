import { NextResponse } from 'next/server';
import { getPrincipal, requireTripMember, type Principal } from '@/src/lib/authz';

/**
 * Shared wrapper for the REST write routes. Requires a principal (Better Auth
 * session or x-api-key machine bypass), optionally checks trip membership
 * (`opts.tripId`; non-members get 404 so trip existence can't be probed),
 * parses the JSON body (skipped for DELETE), runs `handler(body, principal)`,
 * and maps thrown errors uniformly: 'unauthorized' → 401, a "… not found"
 * message → 404, anything else (zod validation, etc.) → 400. The handler
 * returns the JSON payload to send (or `undefined` → `{ ok: true }`).
 *
 * Routes stay one-liners that just call the matching Server Action, so all the
 * validation / side-effects / revalidation live in one place (the action).
 */
export async function restWrite(
  req: Request,
  handler: (body: unknown, principal: Principal) => Promise<unknown>,
  opts: { tripId?: string } = {},
): Promise<Response> {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: unknown;
  if (req.method !== 'DELETE') {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
  }
  try {
    if (opts.tripId) requireTripMember(principal, opts.tripId);
    const result = await handler(body, principal);
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    const message = (err as Error)?.message ?? 'invalid';
    if (message === 'unauthorized') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const notFound = /not found/i.test(message);
    return NextResponse.json(
      { error: notFound ? 'not_found' : 'invalid_input', message },
      { status: notFound ? 404 : 400 },
    );
  }
}
