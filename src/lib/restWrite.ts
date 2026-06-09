import { NextResponse } from 'next/server';
import { isWriteAuthorized } from '@/src/lib/apiKey';

/**
 * Shared wrapper for the native-client REST write routes. Enforces
 * `isWriteAuthorized` (open unless BURGERGO_API_KEY is set), parses the JSON body
 * (skipped for DELETE), runs `handler`, and maps thrown errors uniformly: a
 * "… not found" message → 404, anything else (zod validation, etc.) → 400. The
 * handler returns the JSON payload to send (or `undefined` → `{ ok: true }`).
 *
 * Routes stay one-liners that just call the matching Server Action, so all the
 * validation / side-effects / revalidation live in one place (the action).
 */
export async function restWrite(
  req: Request,
  handler: (body: unknown) => Promise<unknown>,
): Promise<Response> {
  if (!isWriteAuthorized(req)) {
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
    const result = await handler(body);
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    const message = (err as Error)?.message ?? 'invalid';
    const notFound = /not found/i.test(message);
    return NextResponse.json(
      { error: notFound ? 'not_found' : 'invalid_input', message },
      { status: notFound ? 404 : 400 },
    );
  }
}
