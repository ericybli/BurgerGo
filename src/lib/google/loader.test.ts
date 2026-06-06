import { describe, it, expect, vi, beforeEach } from 'vitest';

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

  it('injects exactly one script and resolves with window.google.maps after the script loads', async () => {
    const fakeMaps = { Map: vi.fn(), places: {} };
    const fakeGoogle = { maps: fakeMaps };
    const loadScript = vi.fn(async () => {
      (globalThis as unknown as { google: unknown }).google = fakeGoogle;
    });

    const p1 = loadGoogleMaps({ loadScript, apiKey: 'BROWSER_KEY' });
    const p2 = loadGoogleMaps({ loadScript, apiKey: 'BROWSER_KEY' });
    const [g1, g2] = await Promise.all([p1, p2]);

    expect(g1).toBe(fakeMaps);
    expect(g2).toBe(fakeMaps);
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

  it('real callback path: resolves when Google invokes the named callback (not onload)', async () => {
    // Simulate the real browser path by NOT providing loadScript.
    // Instead, we intercept document.createElement to capture the script el,
    // then simulate Google invoking the registered callback.
    const fakeMaps = { Map: vi.fn(), places: { AutocompleteService: vi.fn() } };
    const fakeGoogle = { maps: fakeMaps };

    let capturedCallback: (() => void) | null = null;

    // Intercept document.head.appendChild to capture the callback name from src.
    const realAppendChild = document.head.appendChild.bind(document.head);
    const appendSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        // Extract the callback name from the script src.
        const url = new URL(node.src);
        const cbName = url.searchParams.get('callback');
        if (cbName) {
          capturedCallback = (globalThis as Record<string, unknown>)[cbName] as () => void;
        }
        // Do NOT actually append (no real network).
        return node;
      }
      return realAppendChild(node);
    });

    // Start the real load (no loadScript injection = real path).
    const promise = loadGoogleMaps({ apiKey: 'BROWSER_KEY' });

    // At this point Google hasn't responded yet — callback not fired.
    // Simulate Google setting up the namespace and invoking the callback.
    (globalThis as unknown as { google: unknown }).google = fakeGoogle;
    if (capturedCallback) {
      (capturedCallback as () => void)();
    }

    const result = await promise;
    expect(result).toBe(fakeMaps);

    appendSpy.mockRestore();
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
