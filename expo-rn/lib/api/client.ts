/**
 * Core HTTP client for the hosted BurgerGo backend. Every call carries the
 * Better Auth session cookie (authHeaders); the server requires a session on
 * all JSON routes. Photo/media GETs are tokenless and bypass this client.
 */
import { Platform } from 'react-native';
import { cacheJson, localPhotoUri, readCachedJson } from '../offlineStore';
import { sessionCookie } from '../auth';
import { reportDataSource } from '../dataSource';
export { API_BASE } from './base';
import { API_BASE } from './base';

/**
 * iOS NSURLSession otherwise overrides a manually-set `Cookie` header with its
 * own (empty) cookie jar, so the session cookie never reaches the server and
 * every request 401s. `credentials: 'omit'` makes the native layer honor our
 * header — this is exactly what @better-auth/expo's own fetch does (it sets
 * `options.credentials = "omit"` before attaching `getCookie()`). Web keeps the
 * default (browser cookie jar / x-api-key debug path).
 */
export const CREDENTIALS: RequestCredentials | undefined = Platform.OS === 'web' ? undefined : 'omit';

/**
 * Dev-only machine key for expo-web debugging, where the browser can't carry
 * the cross-origin session cookie: set EXPO_PUBLIC_API_KEY to the backend's
 * BURGERGO_API_KEY and every request authenticates as the machine principal.
 * Unset in real builds (EAS env does not define it).
 */
export const WRITE_KEY: string = process.env.EXPO_PUBLIC_API_KEY || '';

/** Auth headers for every backend call: session cookie (native) and/or dev key. */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookie = sessionCookie();
  if (cookie) headers.Cookie = cookie;
  if (WRITE_KEY) headers['x-api-key'] = WRITE_KEY;
  return headers;
}

type PhotoSize = 'thumb' | 'card' | 'full';

/**
 * GET with offline support: every success is written through to the JSON
 * cache; any failure (offline, server error) falls back to the last cached
 * response for the same path. The original error propagates on a cache miss.
 */
export async function getJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(), credentials: CREDENTIALS });
    if (!res.ok) throw new Error(`HTTP ${res.status} for GET ${path}`);
    const data = (await res.json()) as T;
    void cacheJson(path, data);
    reportDataSource('live');
    return data;
  } catch (err) {
    const hit = await readCachedJson<T>(path);
    if (hit) {
      reportDataSource('cache');
      return hit.data;
    }
    throw err;
  }
}

export async function writeJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...authHeaders() };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: CREDENTIALS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${method} ${path}`);
  return (await res.json()) as T;
}

/** Multipart upload. `file` is an RN asset {uri,name,type}; on web, `uri` may
 *  be a blob:/data: URL (fetched back into a Blob so browser FormData works). */
export async function postForm<T>(
  path: string,
  fields: Record<string, string>,
  file: { uri: string; name: string; type: string },
  fileField = 'image',
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (typeof document !== 'undefined') {
    // Web: browser FormData doesn't understand the RN {uri,name,type} shape.
    const blob = await (await fetch(file.uri)).blob();
    form.append(fileField, new File([blob], file.name, { type: file.type }));
  } else {
    // RN FormData accepts the {uri,name,type} shape for file parts.
    form.append(fileField, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }
  const headers: Record<string, string> = { ...authHeaders() };
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, credentials: CREDENTIALS, body: form });
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) code = j.error;
    } catch {
      // non-JSON error body; keep the status code
    }
    throw new Error(code);
  }
  return (await res.json()) as T;
}

// --- image URL builders (build from id; never use raw path strings) ---------

/** Offline-first: a locally downloaded copy wins over the remote URL. */
const photo = (remote: string): string => localPhotoUri(remote) ?? remote;

export const photoUrl = {
  personal: (photoId: string, size: PhotoSize = 'thumb') =>
    photo(`${API_BASE}/api/photos/p/${photoId}/${size}`),
  restaurant: (restaurantId: string, size: PhotoSize = 'card') =>
    photo(`${API_BASE}/api/photos/r/${restaurantId}/${size}`),
  /** A place's cached Google photo (keyed by place id). */
  place: (placeId: string, size: PhotoSize = 'card') =>
    photo(`${API_BASE}/api/photos/${placeId}/${size}`),
  linkThumb: (linkId: string) => photo(`${API_BASE}/api/links/thumb/${linkId}`),
  /** User avatar; `imagePath` is the relative path stored on user.image. */
  avatar: (imagePath: string) => photo(`${API_BASE}${imagePath}`),
};
