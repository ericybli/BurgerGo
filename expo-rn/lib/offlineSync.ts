/**
 * "Download for offline" sweep: pulls every trip's JSON through the normal api
 * client (whose write-through fills the AsyncStorage cache) and downloads all
 * referenced photos into the file cache. Running it again re-downloads
 * everything — that IS the refresh (photo URLs are id-based, but Google-cached
 * bytes can change in place after a server refetch).
 *
 * Not cached: live-only data (POI cards, Google autocomplete, open-now) and
 * ticket attachments (original PDFs can't be opened from a file:// URI via
 * Linking on iOS — revisit with a proper viewer).
 */
import { Platform } from 'react-native';
import { api, API_BASE, type Trip } from './api';
import { deriveDays } from './days';
import {
  downloadPhoto,
  setOfflineMeta,
  type OfflineMeta,
} from './offlineStore';

export type SyncProgress = {
  phase: 'data' | 'photos';
  done: number;
  total: number;
  label: string;
};

type Size = 'thumb' | 'card' | 'full';

// Remote URLs built directly — photoUrl.* would return file:// URIs for
// anything already cached, which must never feed the downloader.
const personalUrl = (id: string, s: Size) => `${API_BASE}/api/photos/p/${id}/${s}`;
const placeUrl_ = (id: string, s: Size) => `${API_BASE}/api/photos/${id}/${s}`;
const restaurantUrl = (id: string, s: Size) => `${API_BASE}/api/photos/r/${id}/${s}`;
const linkThumbUrl = (id: string) => `${API_BASE}/api/links/thumb/${id}`;

function personal(set: Set<string>, id: string, sizes: Size[]) {
  for (const s of sizes) set.add(personalUrl(id, s));
}

/** Collect one trip's JSON (write-through caches it) + its photo URLs. */
async function sweepTrip(trip: Trip, urls: Set<string>): Promise<void> {
  const [placesR, eats, , , , journal] = await Promise.all([
    api.places.list(trip.id),
    api.eats.list(trip.id),
    api.budget.get(trip.id),
    api.packing.list(trip.id),
    api.tasks.list(trip.id),
    api.journal.get(trip.id),
    api.tickets.list(trip.id),
  ]);

  // Weather per trip day (cheap; offline TripOverview then shows the last fetch).
  await Promise.all(
    deriveDays(trip.startDate, trip.endDate).map((d) =>
      api.weather.day(trip.id, d.date).catch(() => null),
    ),
  );

  if (trip.coverPhoto) personal(urls, trip.coverPhoto, ['card', 'full']);

  for (const p of placesR.places) {
    for (const ph of p.photos) personal(urls, ph.id, ['thumb', 'card', 'full']);
    if (p.photoPath != null) {
      for (const s of ['thumb', 'card', 'full'] as Size[]) urls.add(placeUrl_(p.id, s));
    }
  }
  for (const r of eats.restaurants) {
    for (const ph of r.photos) personal(urls, ph.id, ['thumb', 'card', 'full']);
    if (r.photoPath != null) {
      for (const s of ['thumb', 'card', 'full'] as Size[]) urls.add(restaurantUrl(r.id, s));
    }
  }
  for (const e of journal.entries) for (const ph of e.photos) personal(urls, ph.id, ['thumb', 'full']);
  for (const l of journal.photoLists ?? []) for (const ph of l.photos) personal(urls, ph.id, ['thumb', 'full']);
  for (const l of journal.links) if (l.thumbnail) urls.add(linkThumbUrl(l.id));
}

/** Bounded-concurrency photo download; failures are counted, not fatal. */
async function downloadAllPhotos(
  urls: string[],
  onProgress: (done: number, total: number) => void,
): Promise<{ files: number; bytes: number; failed: number }> {
  let done = 0;
  let files = 0;
  let bytes = 0;
  let failed = 0;
  const queue = [...urls];
  const CONCURRENCY = 4;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const url = queue.shift();
        if (!url) return;
        try {
          bytes += await downloadPhoto(url);
          files += 1;
        } catch {
          failed += 1;
        }
        done += 1;
        onProgress(done, urls.length);
      }
    }),
  );
  return { files, bytes, failed };
}

/** Full offline sweep. Throws only when the very first fetch fails (offline). */
export async function downloadAllForOffline(
  onProgress: (p: SyncProgress) => void,
): Promise<OfflineMeta & { failed: number }> {
  const urls = new Set<string>();

  const trips = await api.trips.list();
  await api.settings.get().catch(() => null);

  let endpoints = 2;
  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i]!;
    onProgress({ phase: 'data', done: i, total: trips.length, label: trip.name });
    await sweepTrip(trip, urls);
    endpoints += 7;
  }

  // Web debug build: no file:// cache — JSON only.
  const list = Platform.OS === 'web' ? [] : [...urls];
  onProgress({ phase: 'photos', done: 0, total: list.length, label: '' });
  const { files, bytes, failed } = await downloadAllPhotos(list, (done, total) =>
    onProgress({ phase: 'photos', done, total, label: '' }),
  );

  const meta: OfflineMeta = { ts: Date.now(), endpoints, files, bytes };
  await setOfflineMeta(meta);
  return { ...meta, failed };
}
