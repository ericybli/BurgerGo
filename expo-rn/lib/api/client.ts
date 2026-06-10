/**
 * Core HTTP client for the hosted BurgerGo backend. Reads are public JSON GET
 * routes; writes are REST mirrors of the web app's Server Actions (open unless
 * the server sets BURGERGO_API_KEY — then set WRITE_KEY to the same value).
 */
import { cacheJson, localPhotoUri, readCachedJson } from '../offlineStore';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || 'https://eric.month2month.com/burgergo';

/** Optional write key; sent as `x-api-key` when non-empty. */
export const WRITE_KEY: string = '';

type PhotoSize = 'thumb' | 'card' | 'full';

/**
 * GET with offline support: every success is written through to the JSON
 * cache; any failure (offline, server error) falls back to the last cached
 * response for the same path. The original error propagates on a cache miss.
 */
export async function getJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} for GET ${path}`);
    const data = (await res.json()) as T;
    void cacheJson(path, data);
    return data;
  } catch (err) {
    const hit = await readCachedJson<T>(path);
    if (hit) return hit.data;
    throw err;
  }
}

export async function writeJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (WRITE_KEY) headers['x-api-key'] = WRITE_KEY;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
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
  const headers: Record<string, string> = {};
  if (WRITE_KEY) headers['x-api-key'] = WRITE_KEY;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
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
};
