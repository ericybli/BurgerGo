import { afterEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/src/lib/authz');

// Real module, but with auth.api.getSession stubbed (no HTTP session in tests)
// and db pointed at a throwaway in-memory database.
vi.mock('@/src/lib/auth', () => ({
  auth: { api: { getSession: vi.fn(async () => null) } },
}));
vi.mock('@/src/db/client', async () => {
  const { makeTestDb } = await import('@/src/db/testDb');
  return { db: makeTestDb().db };
});

const { getPrincipal, requireTripMember } = await import('@/src/lib/authz');

describe('authz', () => {
  afterEach(() => {
    delete process.env.BURGERGO_API_KEY;
  });

  it('matching x-api-key yields a machine principal', async () => {
    process.env.BURGERGO_API_KEY = 'k';
    const req = new Request('http://x/', { headers: { 'x-api-key': 'k' } });
    expect(await getPrincipal(req)).toEqual({ kind: 'machine' });
  });

  it('no key and no session → null', async () => {
    expect(await getPrincipal(new Request('http://x/'))).toBeNull();
  });

  it('machine bypasses membership; non-member user throws not found', () => {
    expect(() => requireTripMember({ kind: 'machine' }, 'any-trip')).not.toThrow();
    expect(() =>
      requireTripMember(
        { kind: 'user', userId: 'u', email: 'e', name: 'n', image: null },
        'missing-trip',
      ),
    ).toThrow(/not found/i);
  });
});
