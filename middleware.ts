import { NextRequest, NextResponse } from 'next/server';

/**
 * Coarse login gate for PAGES: no session cookie → /login. API routes enforce
 * for real (this can't check validity without a DB hit). Skips static assets,
 * the API (incl. /api/auth), and /login itself. basePath is handled by Next.
 *
 * Cookie names are Better Auth defaults (`better-auth` prefix + `session_token`,
 * `__Secure-` prefixed on https) — verified against better-auth/dist/cookies.
 */
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has('better-auth.session_token') ||
    req.cookies.has('__Secure-better-auth.session_token');
  if (hasSession) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Everything except: api, _next, static files with an extension, login
    '/((?!api|_next|login|.*\\..*).*)',
  ],
};
