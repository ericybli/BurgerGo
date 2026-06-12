import { headers } from 'next/headers';
import { auth } from '@/src/lib/auth';
import { db } from '@/src/db/client';
import { isMember } from '@/src/db/repos/tripMembers';

/**
 * Who is calling. 'machine' = matching x-api-key (scripts / MCP) — bypasses
 * membership checks entirely. 'user' = a Better Auth session.
 */
export type Principal =
  | { kind: 'machine' }
  | { kind: 'user'; userId: string; email: string; name: string; image: string | null };

function machineFrom(get: (name: string) => string | null): Principal | null {
  const key = process.env.BURGERGO_API_KEY;
  if (key && get('x-api-key') === key) return { kind: 'machine' };
  return null;
}

async function principalFromHeaders(h: Headers): Promise<Principal | null> {
  const machine = machineFrom((n) => h.get(n));
  if (machine) return machine;
  const s = await auth.api.getSession({ headers: h });
  if (!s) return null;
  return {
    kind: 'user',
    userId: s.user.id,
    email: s.user.email,
    name: s.user.name,
    image: s.user.image ?? null,
  };
}

/** Route-handler variant: principal from the incoming Request. */
export function getPrincipal(req: Request): Promise<Principal | null> {
  return principalFromHeaders(req.headers);
}

/** Server Action variant: principal from next/headers. Throws 'unauthorized'. */
export async function requireUserAction(): Promise<Principal> {
  const p = await principalFromHeaders(await headers());
  if (!p) throw new Error('unauthorized');
  return p;
}

/**
 * Trip access check. Machine principals always pass. Throws '… not found'
 * (mapped to 404 by restWrite — non-members can't probe trip existence).
 */
export function requireTripMember(principal: Principal, tripId: string): void {
  if (principal.kind === 'machine') return;
  if (!isMember(db, principal.userId, tripId)) throw new Error('Trip not found');
}
