import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/src/env', () => ({ env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'BROWSER_KEY' } }));

import {
  buildMapsScriptUrl,
  loadGoogleMaps,
  __resetMapsLoaderForTests,
  SessionTokenManager,
} from '@/src/lib/google/loader';

describe('buildMapsScriptUrl', () => {
  it('includes the browser key, places library, async loading, and a callback', () => {
    const u = new URL(buildMapsScriptUrl('BROWSER_KEY', 'cb'));
    expect(u.origin + u.pathname).toBe('https://maps.googleapis.com/maps/api/js');
    expect(u.searchParams.get('key')).toBe('BROWSER_KEY');
    expect(u.searchParams.get('libraries')).toBe('places');
    expect(u.searchParams.get('loading')).toBe('async');
    expect(u.searchParams.get('callback')).toBe('cb');
  });
});

describe('loadGoogleMaps', () => {
  beforeEach(() => {
    __resetMapsLoaderForTests();
  });

  it('injects exactly one script and resolves with window.google after the script loads', async () => {
    const fakeGoogle = { maps: { Map: vi.fn(), places: {} } };
    const loadScript = vi.fn(async () => {
      (globalThis as unknown as { google: unknown }).google = fakeGoogle;
    });

    const p1 = loadGoogleMaps({ loadScript });
    const p2 = loadGoogleMaps({ loadScript });
    const [g1, g2] = await Promise.all([p1, p2]);

    expect(g1).toBe(fakeGoogle);
    expect(g2).toBe(fakeGoogle);
    // Memoized: only one injection even with two concurrent callers.
    expect(loadScript).toHaveBeenCalledTimes(1);
    const calledUrl = (loadScript.mock.calls[0] as unknown[])[0] as string;
    expect(calledUrl).toContain('key=BROWSER_KEY');
  });

  it('rejects when no browser key is configured', async () => {
    const loadScript = vi.fn(async () => {});
    await expect(loadGoogleMaps({ loadScript, apiKey: '' })).rejects.toThrow(/key/i);
    expect(loadScript).not.toHaveBeenCalled();
  });
});

describe('SessionTokenManager', () => {
  it('returns a stable token until consumed, then mints a fresh one', () => {
    let n = 0;
    const mint = () => ({ id: `tok-${++n}` });
    const mgr = new SessionTokenManager(mint);

    const a = mgr.current();
    const b = mgr.current();
    expect(a).toBe(b); // same token across keystrokes in one session

    mgr.consume(); // Place Details was fetched → session ends
    const c = mgr.current();
    expect(c).not.toBe(a); // fresh session after selection
    expect((c as { id: string }).id).toBe('tok-2');
  });

  it('reset() also mints a fresh token (blur/cancel)', () => {
    let n = 0;
    const mgr = new SessionTokenManager(() => ({ id: `t${++n}` }));
    const a = mgr.current();
    mgr.reset();
    expect(mgr.current()).not.toBe(a);
  });
});
