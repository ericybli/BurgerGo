import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { now } from '@/src/lib/clock';
import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';
import { fetchPlaceDetails, type CategoryGuess } from '@/src/lib/google/server';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';
import type { PlaceDetailsCacheRow } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

interface DetailsResponse {
  googlePlaceId: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  categoryGuess: string | null;
  photoRef: string | null;
  photoLocalPath: string | null;
  cached: boolean;
}

function toResponse(row: PlaceDetailsCacheRow, cached: boolean): DetailsResponse {
  return {
    googlePlaceId: row.googlePlaceId,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    categoryGuess: row.categoryGuess,
    photoRef: row.photoRef,
    photoLocalPath: row.photoLocalPath,
    cached,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get('placeId');
  const sessionToken = url.searchParams.get('sessionToken') ?? undefined;
  const refresh = url.searchParams.get('refresh') === '1';
  if (!placeId) {
    return NextResponse.json({ error: 'missing_placeId' }, { status: 400 });
  }

  const existing = getCachedDetails(db, placeId);
  if (existing && !refresh) {
    return NextResponse.json(toResponse(existing, true));
  }

  if (!env.GOOGLE_MAPS_SERVER_KEY) {
    if (existing) return NextResponse.json(toResponse(existing, true));
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }

  try {
    const d = await fetchPlaceDetails({
      placeId,
      sessionToken,
      apiKey: env.GOOGLE_MAPS_SERVER_KEY,
    });
    const gid = d.googlePlaceId || placeId;

    // Auto-fill the place photo: download Google's photo once and cache it
    // locally so the read card + photo handler can serve it. Reuse an existing
    // local copy (e.g. on refresh) rather than re-downloading.
    let photoLocalPath: string | null = existing?.photoLocalPath ?? null;
    if (d.photoRef && !photoLocalPath) {
      photoLocalPath = await fetchAndStoreGooglePhoto({
        photoRef: d.photoRef,
        googlePlaceId: gid,
        apiKey: env.GOOGLE_MAPS_SERVER_KEY,
        uploadsDir: env.UPLOADS_DIR,
      });
    }

    const saved = upsertDetails(db, {
      googlePlaceId: gid,
      name: d.name,
      address: d.address,
      lat: d.lat,
      lng: d.lng,
      categoryGuess: d.categoryGuess satisfies CategoryGuess,
      photoRef: d.photoRef,
      photoLocalPath,
      rawJson: JSON.stringify(d),
      fetchedAt: new Date(now()),
    });
    return NextResponse.json(toResponse(saved, false));
  } catch {
    if (existing) return NextResponse.json(toResponse(existing, true));
    return NextResponse.json({ error: 'google_unavailable' }, { status: 502 });
  }
}
