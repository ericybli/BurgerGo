import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { listAllForTrip, addPlace, updatePlace } from '@/src/db/repos/places';
import { listDayModes } from '@/src/db/repos/dayModes';
import { listDayTitles } from '@/src/db/repos/dayTitles';
import { listByTrip as listSavedLists, addList } from '@/src/db/repos/savedLists';
import { getSettings } from '@/src/db/repos/settings';
import { fetchForwardGeocode } from '@/src/lib/google/server';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';
import { restRead } from '@/src/lib/restRead';
import { travelLegs, placeDetailsCache, photos as photosTable, savedLinks, type Place, type TravelLeg, type Photo } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/**
 * PlaceDTO: all Place fields + photoPath resolved from place_details_cache
 * via googlePlaceId. photoPath is null when there is no cache row.
 * photos: personal photos for this place, ordered (Plan 2).
 */
export interface PlaceDTO extends Place {
  photoPath: string | null;
  photos: { id: string; width: number | null; height: number | null }[];
  links: { id: string; url: string; title: string | null; thumbnail: string | null }[];
}

/**
 * LegDTO: all TravelLeg fields (including polyline from the schema).
 */
export type LegDTO = TravelLeg;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  return restRead(req, tripId, () => {
    // Detail levels (perf): the heavy fields — per-place `aiSummary` (≈1–2 KB each)
    // + per-leg route `polyline` — are only needed by the read card + map, never
    // the list. `?detail=full` ships everything; the default (light) payload omits
    // those two; `?detail=heavy` returns ONLY those two (as a slim id-keyed payload)
    // so the background hydrate after a light paint doesn't re-run the photo/link/
    // list queries it doesn't need.
    const detail = new URL(req.url).searchParams.get('detail');
    const full = detail === 'full';
    const heavy = detail === 'heavy';
    const trip = getTrip(db, tripId);
    if (!trip) throw new Error('Trip not found');

    // Heavy-only fast path: just the two heavy fields, no photo/cache/link/list work.
    if (heavy) {
      const heavyPlaces = listAllForTrip(db, tripId).map((p) => ({ id: p.id, aiSummary: p.aiSummary }));
      const heavyLegs = db
        .select({
          fromPlaceId: travelLegs.fromPlaceId,
          toPlaceId: travelLegs.toPlaceId,
          mode: travelLegs.mode,
          polyline: travelLegs.polyline,
        })
        .from(travelLegs)
        .where(eq(travelLegs.tripId, tripId))
        .all();
      return { places: heavyPlaces, legs: heavyLegs };
    }

    const rawPlaces = listAllForTrip(db, tripId);

    // Batch-fetch photoLocalPath from place_details_cache for all places in one
    // query instead of one query per place (avoids N+1).
    const googlePlaceIds = rawPlaces
      .map((p) => p.googlePlaceId)
      .filter((id): id is string => id !== null);

    const photoMap = new Map<string, string | null>();
    if (googlePlaceIds.length > 0) {
      const cacheRows = db
        .select({
          googlePlaceId: placeDetailsCache.googlePlaceId,
          photoLocalPath: placeDetailsCache.photoLocalPath,
        })
        .from(placeDetailsCache)
        .where(inArray(placeDetailsCache.googlePlaceId, googlePlaceIds))
        .all();
      for (const row of cacheRows) {
        photoMap.set(row.googlePlaceId, row.photoLocalPath ?? null);
      }
    }

    // Batch-load personal photos for all places (owner_type = 'place').
    const placeIds = rawPlaces.map((p) => p.id);
    const photoMapByOwner = new Map<string, { id: string; width: number | null; height: number | null }[]>();
    if (placeIds.length > 0) {
      const photoRows: Photo[] = db
        .select()
        .from(photosTable)
        .where(
          and(
            eq(photosTable.ownerType, 'place'),
            inArray(photosTable.ownerId, placeIds),
          ),
        )
        .orderBy(asc(photosTable.ownerId), asc(photosTable.orderIndex))
        .all();
      for (const row of photoRows) {
        const list = photoMapByOwner.get(row.ownerId) ?? [];
        list.push({ id: row.id, width: row.width, height: row.height });
        photoMapByOwner.set(row.ownerId, list);
      }
    }

    // Batch-load attached travel-guide links for all places (place_id set).
    const linksByPlace = new Map<string, { id: string; url: string; title: string | null; thumbnail: string | null }[]>();
    if (placeIds.length > 0) {
      const linkRows = db
        .select({ id: savedLinks.id, placeId: savedLinks.placeId, url: savedLinks.url, title: savedLinks.title, thumbnail: savedLinks.thumbnail })
        .from(savedLinks)
        .where(inArray(savedLinks.placeId, placeIds))
        .orderBy(asc(savedLinks.placeId), desc(savedLinks.createdAt))
        .all();
      for (const row of linkRows) {
        if (!row.placeId) continue;
        const list = linksByPlace.get(row.placeId) ?? [];
        list.push({ id: row.id, url: row.url, title: row.title, thumbnail: row.thumbnail });
        linksByPlace.set(row.placeId, list);
      }
    }

    // Build PlaceDTO using the pre-fetched maps. `aiSummary` is dropped from the
    // light payload (see `full` above) — the list never renders it.
    const placesResult: PlaceDTO[] = rawPlaces.map((p) => ({
      ...p,
      aiSummary: full ? p.aiSummary : null,
      photoPath: (p.googlePlaceId ? (photoMap.get(p.googlePlaceId) ?? null) : null),
      photos: photoMapByOwner.get(p.id) ?? [],
      links: linksByPlace.get(p.id) ?? [],
    }));

    const legRows: LegDTO[] = db
      .select()
      .from(travelLegs)
      .where(eq(travelLegs.tripId, tripId))
      .all();
    // Light payload drops the (large) encoded route polyline; the map falls back
    // to straight stop-to-stop segments until the full payload hydrates it in.
    const legs: LegDTO[] = full ? legRows : legRows.map((l) => ({ ...l, polyline: null }));

    // Per-day default travel mode (sparse map dayDate → mode); days without a row
    // fall back to DEFAULT_DAY_MODE on the client. Small, so always included.
    const dayModes: Record<string, 'walk' | 'drive' | 'transit'> = Object.fromEntries(
      listDayModes(db, tripId).map((d) => [d.dayDate, d.mode]),
    );

    // Saved-place grouping lists for this trip (slim: id + name), in display order.
    const lists = listSavedLists(db, tripId).map((l) => ({ id: l.id, name: l.name }));

    // Global display currency — lets the place-cost field format correctly (F3).
    const currency = getSettings(db)?.currency ?? env.DEFAULT_CURRENCY;

    const dayTitles: Record<string, string> = Object.fromEntries(
      listDayTitles(db, tripId).map((r) => [r.dayDate, r.title]),
    );
    return { places: placesResult, legs, dayModes, dayTitles, lists, currency };
  });
}

const CATEGORY = z.enum([
  'sightseeing', 'lodging', 'hotel', 'airbnb', 'airport', 'transport',
  'activity', 'shopping', 'parking', 'entrance', 'museum', 'event', 'other',
]);

const createPlaceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  about: z.string().max(4000).optional(), // → aiSummary
  notes: z.string().max(2000).optional(),
  category: CATEGORY.optional(),
  /** Saved-list name to group this place under; find-or-created (case-insensitive). */
  list: z.string().trim().min(1).max(100).optional(),
  // Native-client extras — the MCP caller omits these, so its saved-place behavior
  // is unchanged. When coords are supplied they're used as-is (no geocode); a
  // dayDate adds the place to that day instead of the Saved bucket.
  dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  googlePlaceId: z.string().trim().min(1).max(300).nullish(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  durationMin: z.number().int().nonnegative().nullish(),
  cost: z.number().int().nullish(),
});

/**
 * Create a Saved place (dayDate = null) for a trip — the write side used by the
 * BurgerGo MCP. Best-effort forward-geocodes the address to coordinates (so it
 * maps) and captures the Google place id. Photos are attached separately via
 * POST /api/photos. Requires a principal (session or x-api-key) + trip membership.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    requireTripMember(principal, tripId);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const trip = getTrip(db, tripId);
  if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const parsed = createPlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  const { name, address, about, notes, category, list, dayDate, scheduledTime, durationMin, cost } = parsed.data;

  // Group under a named saved list when requested: reuse a same-named list
  // (case-insensitive), else create it. NULL = loose.
  let listId: string | null = null;
  if (list) {
    const existing = listSavedLists(db, tripId).find((l) => l.name.toLowerCase() === list.toLowerCase());
    listId = existing ? existing.id : addList(db, tripId, list).id;
  }

  // Use coords if the caller supplied them; otherwise best-effort geocode the
  // address so the place still maps + gets a Google place id.
  let lat: number | null = parsed.data.lat ?? null;
  let lng: number | null = parsed.data.lng ?? null;
  let googlePlaceId: string | null = parsed.data.googlePlaceId ?? null;
  if (lat == null && lng == null && address && env.GOOGLE_MAPS_SERVER_KEY) {
    try {
      const geo = await fetchForwardGeocode({ address, apiKey: env.GOOGLE_MAPS_SERVER_KEY });
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        googlePlaceId = geo.googlePlaceId;
      }
    } catch {
      // geocode unavailable → save without coordinates (still lists)
    }
  }

  const place = addPlace(db, {
    tripId,
    dayDate: dayDate ?? null, // null = Saved bucket
    name,
    address: address ?? null,
    lat,
    lng,
    googlePlaceId,
    category: category ?? 'other',
    scheduledTime: scheduledTime ?? null,
    durationMin: durationMin ?? null,
    cost: cost ?? null,
    notes: notes ?? null,
    listId,
  });
  // "about" maps to the editable AI-summary field.
  const finalPlace = about ? (updatePlace(db, place.id, { aiSummary: about }) ?? place) : place;

  return NextResponse.json({ place: finalPlace }, { status: 201 });
}
