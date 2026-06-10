/**
 * Core HTTP client for the hosted BurgerGo backend. Reads are public JSON GET
 * routes; writes are REST mirrors of the web app's Server Actions (open unless
 * the server sets BURGERGO_API_KEY — then set WRITE_KEY to the same value).
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || 'https://eric.month2month.com/burgergo';

/** Optional write key; sent as `x-api-key` when non-empty. */
export const WRITE_KEY: string = '';

type PhotoSize = 'thumb' | 'card' | 'full';

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for GET ${path}`);
  return (await res.json()) as T;
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

export const photoUrl = {
  personal: (photoId: string, size: PhotoSize = 'thumb') =>
    `${API_BASE}/api/photos/p/${photoId}/${size}`,
  restaurant: (restaurantId: string, size: PhotoSize = 'card') =>
    `${API_BASE}/api/photos/r/${restaurantId}/${size}`,
  /** A place's cached Google photo (keyed by place id). */
  place: (placeId: string, size: PhotoSize = 'card') =>
    `${API_BASE}/api/photos/${placeId}/${size}`,
  linkThumb: (linkId: string) => `${API_BASE}/api/links/thumb/${linkId}`,
};
