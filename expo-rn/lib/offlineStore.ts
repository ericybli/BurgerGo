/**
 * Offline cache primitives. Two stores:
 *
 * 1. JSON cache (AsyncStorage) — every successful GET is written through here
 *    by lib/api/client.getJson, which falls back to it when the network (or
 *    server) fails. So anything the user has ever loaded works offline, and
 *    the explicit "Download for offline" sweep just warms it completely.
 * 2. Photo file cache (expo-file-system, native only) — image bytes downloaded
 *    by lib/offlineSync. The photoUrl builders consult `localPhotoUri()`
 *    synchronously, so an in-memory name index is loaded once at app start
 *    (initPhotoCache from App.tsx).
 *
 * This module must NOT import lib/api (client.ts imports it — keep acyclic).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const JSON_PREFIX = 'bg.cache:';
const META_KEY = 'bg.offline.meta';

// --- JSON cache --------------------------------------------------------------

export async function cacheJson(path: string, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(JSON_PREFIX + path, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // quota/serialization failure — cache write is best-effort
  }
}

export async function readCachedJson<T>(path: string): Promise<{ ts: number; data: T } | null> {
  try {
    const raw = await AsyncStorage.getItem(JSON_PREFIX + path);
    if (!raw) return null;
    return JSON.parse(raw) as { ts: number; data: T };
  } catch {
    return null;
  }
}

/** Drop every cached GET response (kept separate from app prefs). */
export async function clearJsonCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(JSON_PREFIX)));
}

// --- Download metadata (drives the Settings card status line) -----------------

export type OfflineMeta = {
  ts: number; // last successful full download
  endpoints: number;
  files: number;
  bytes: number; // photo bytes on disk
};

export async function getOfflineMeta(): Promise<OfflineMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as OfflineMeta) : null;
  } catch {
    return null;
  }
}

export async function setOfflineMeta(meta: OfflineMeta | null): Promise<void> {
  if (meta === null) await AsyncStorage.removeItem(META_KEY);
  else await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

// --- Photo file cache (native only — file:// URIs don't exist on web) ---------

const PHOTO_DIR =
  Platform.OS === 'web' ? null : `${FileSystem.documentDirectory ?? ''}photocache/`;

/** Names present in PHOTO_DIR; consulted synchronously by photoUrl builders. */
let cachedNames = new Set<string>();
let photoCacheReady = false;

/** Deterministic file name for a remote URL (host-independent, query-safe). */
export function cacheNameFor(remoteUrl: string): string {
  const tail = remoteUrl.replace(/^https?:\/\/[^/]+/, '');
  // Sanitized path keeps names readable; webp extension is safe — RN's image
  // decoders sniff actual bytes, they don't trust extensions.
  return `${tail.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.webp`;
}

/** Load the cache-dir index once at startup (no-op on web). */
export async function initPhotoCache(): Promise<void> {
  if (!PHOTO_DIR) return;
  try {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
    cachedNames = new Set(await FileSystem.readDirectoryAsync(PHOTO_DIR));
  } catch {
    cachedNames = new Set();
  }
  photoCacheReady = true;
}

/** Local file URI for a remote photo URL, or null when not cached. */
export function localPhotoUri(remoteUrl: string): string | null {
  if (!PHOTO_DIR || !photoCacheReady) return null;
  const name = cacheNameFor(remoteUrl);
  return cachedNames.has(name) ? PHOTO_DIR + name : null;
}

/** Download one photo into the cache; returns its size in bytes (0 on skip). */
export async function downloadPhoto(remoteUrl: string): Promise<number> {
  if (!PHOTO_DIR) return 0;
  const name = cacheNameFor(remoteUrl);
  const dest = PHOTO_DIR + name;
  const res = await FileSystem.downloadAsync(remoteUrl, dest);
  if (res.status !== 200) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {});
    throw new Error(`HTTP ${res.status}`);
  }
  cachedNames.add(name);
  const info = await FileSystem.getInfoAsync(dest);
  return info.exists && !info.isDirectory ? (info.size ?? 0) : 0;
}

/** Remove every cached photo file. */
export async function clearPhotoCache(): Promise<void> {
  if (!PHOTO_DIR) return;
  await FileSystem.deleteAsync(PHOTO_DIR, { idempotent: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true }).catch(() => {});
  cachedNames = new Set();
}
