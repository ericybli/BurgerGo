/**
 * Client-side Google Maps JS loader. Loads the Maps JS API with the `places`
 * library using the public browser key, memoizing the load promise so the
 * script is injected at most once per page.
 *
 * Script injection is isolated behind an injectable `loadScript` so the loader
 * is unit-testable in jsdom with no network. Also exports the Autocomplete
 * session-token lifecycle (one token per search→selection).
 */

const MAPS_JS_BASE = 'https://maps.googleapis.com/maps/api/js';

export interface GoogleNamespace {
  maps: unknown;
}

export function buildMapsScriptUrl(apiKey: string, callbackName: string): string {
  const params = new URLSearchParams({
    key: apiKey,
    libraries: 'places',
    loading: 'async',
    v: 'weekly',
    callback: callbackName,
  });
  return `${MAPS_JS_BASE}?${params.toString()}`;
}

/** Default browser script injector — appends a <script> and rejects on error.
 *  Resolution is handled by the Google callback registered on globalThis, NOT
 *  by the script's onload event (with `loading=async` onload fires before
 *  window.google.maps is populated). */
function defaultLoadScript(
  src: string,
  onError: (err: Error) => void,
): void {
  const el = document.createElement('script');
  el.src = src;
  el.async = true;
  el.onerror = () => onError(new Error('Failed to load Google Maps JS'));
  document.head.appendChild(el);
}

let loadPromise: Promise<GoogleNamespace['maps']> | null = null;

export interface LoadOptions {
  /** Injectable for tests; defaults to a real <script> tag injector.
   *  The injected function sets globalThis.google and resolves the returned
   *  promise so the callback path is bypassed in tests. */
  loadScript?: (src: string) => Promise<void>;
  /** Override the key (tests); defaults to the configured browser key. */
  apiKey?: string;
}

/**
 * Load (or reuse) the Maps JS API. Resolves with `window.google.maps`.
 * Concurrent callers share one in-flight promise; a settled load is returned
 * immediately.
 *
 * Real load path: registers a named callback on globalThis so Google's async
 * loader can invoke it once the Maps JS namespace is ready — this is the only
 * correct signal with `loading=async`. The script's onload is NOT used for
 * resolution because it fires before window.google.maps is populated.
 *
 * Test path: callers inject a `loadScript` that sets globalThis.google and
 * resolves; the callback is a no-op in that case.
 */
export function loadGoogleMaps(opts: LoadOptions = {}): Promise<GoogleNamespace['maps']> {
  if (loadPromise) return loadPromise;

  // Read the public browser key as a literal `process.env.NEXT_PUBLIC_*` access
  // so Next.js inlines it into the client bundle at build time. Reading it via
  // the `env` module (parseEnv(process.env)) would NOT inline and yields '' in
  // the browser — leaving the map unable to load even with a valid key set.
  const apiKey = opts.apiKey ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser key)'));
  }

  if (opts.loadScript) {
    // ── Test / injected path ─────────────────────────────────────────────────
    // The injected loadScript sets globalThis.google synchronously before
    // resolving, so we just await it and read the namespace.
    const loadScript = opts.loadScript;
    loadPromise = (async () => {
      const existing = (globalThis as unknown as { google?: GoogleNamespace }).google;
      if (existing?.maps) return existing.maps;
      const callbackName = `__burgergoMapsCb_${Date.now()}`;
      const src = buildMapsScriptUrl(apiKey, callbackName);
      await loadScript(src);
      const g = (globalThis as unknown as { google?: GoogleNamespace }).google;
      if (!g?.maps) throw new Error('Google Maps JS loaded but window.google.maps is undefined');
      return g.maps;
    })();
    return loadPromise;
  }

  // ── Real browser path ──────────────────────────────────────────────────────
  // Register a named callback BEFORE injecting the script tag. Google's async
  // loader invokes it once window.google.maps is fully ready; only then do we
  // resolve. The script's onerror → reject so network failures surface.
  loadPromise = new Promise<GoogleNamespace['maps']>((resolve, reject) => {
    const existing = (globalThis as unknown as { google?: GoogleNamespace }).google;
    if (existing?.maps) { resolve(existing.maps); return; }

    const callbackName = `__burgergoMapsCb_${Date.now()}`;
    (globalThis as Record<string, unknown>)[callbackName] = () => {
      delete (globalThis as Record<string, unknown>)[callbackName];
      const g = (globalThis as unknown as { google?: GoogleNamespace }).google;
      if (g?.maps) {
        resolve(g.maps);
      } else {
        reject(new Error('Google Maps callback fired but window.google.maps is undefined'));
      }
    };

    const src = buildMapsScriptUrl(apiKey, callbackName);
    defaultLoadScript(src, (err) => {
      delete (globalThis as Record<string, unknown>)[callbackName];
      reject(err);
    });
  });

  return loadPromise;
}

/** Test-only: clear the memoized load so each test starts clean. */
export function __resetMapsLoaderForTests(): void {
  loadPromise = null;
  delete (globalThis as unknown as { google?: unknown }).google;
  // Remove any dangling callback registrations from prior test runs.
  for (const key of Object.keys(globalThis as object)) {
    if (key.startsWith('__burgergoMapsCb_')) {
      delete (globalThis as Record<string, unknown>)[key];
    }
  }
}

/**
 * Autocomplete session-token lifecycle. One token spans a typing session and
 * is consumed by the matching Place Details fetch; a fresh token is minted
 * after consume/reset.
 */
export class SessionTokenManager<T = unknown> {
  private token: T | null = null;
  constructor(private readonly mint: () => T) {}

  /** The current session token, minting one lazily if needed. */
  current(): T {
    if (this.token === null) this.token = this.mint();
    return this.token;
  }

  /** Mark the session as spent (Place Details fetched) → next current() mints fresh. */
  consume(): void {
    this.token = null;
  }

  /** Discard the current session without consuming (blur/cancel). */
  reset(): void {
    this.token = null;
  }
}
