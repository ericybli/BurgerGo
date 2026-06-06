/**
 * Client-side Google Maps JS loader. Loads the Maps JS API with the `places`
 * library using the public browser key, memoizing the load promise so the
 * script is injected at most once per page.
 *
 * Script injection is isolated behind an injectable `loadScript` so the loader
 * is unit-testable in jsdom with no network. Also exports the Autocomplete
 * session-token lifecycle (one token per search→selection).
 */
import { env } from '@/src/env';

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

/** Default browser script injector — appends a <script> and resolves on load. */
function defaultLoadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onerror = () => reject(new Error('Failed to load Google Maps JS'));
    el.onload = () => resolve();
    document.head.appendChild(el);
  });
}

let loadPromise: Promise<GoogleNamespace> | null = null;

export interface LoadOptions {
  /** Injectable for tests; defaults to a real <script> tag injector. */
  loadScript?: (src: string) => Promise<void>;
  /** Override the key (tests); defaults to the configured browser key. */
  apiKey?: string;
}

/**
 * Load (or reuse) the Maps JS API. Resolves with `window.google`. Concurrent
 * callers share one in-flight promise; a settled load is returned immediately.
 */
export function loadGoogleMaps(opts: LoadOptions = {}): Promise<GoogleNamespace> {
  if (loadPromise) return loadPromise;

  const apiKey = opts.apiKey ?? env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser key)'));
  }
  const loadScript = opts.loadScript ?? defaultLoadScript;

  loadPromise = (async () => {
    const existing = (globalThis as unknown as { google?: GoogleNamespace }).google;
    if (existing) return existing;
    const callbackName = `__burgergoMapsCb_${Date.now()}`;
    const src = buildMapsScriptUrl(apiKey, callbackName);
    await loadScript(src);
    const g = (globalThis as unknown as { google?: GoogleNamespace }).google;
    if (!g) throw new Error('Google Maps JS loaded but window.google is undefined');
    return g;
  })();

  return loadPromise;
}

/** Test-only: clear the memoized load so each test starts clean. */
export function __resetMapsLoaderForTests(): void {
  loadPromise = null;
  delete (globalThis as unknown as { google?: unknown }).google;
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
