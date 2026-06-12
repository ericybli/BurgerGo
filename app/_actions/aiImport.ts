'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { getSettings } from '@/src/db/repos/settings';
import { addPlace, type Place } from '@/src/db/repos/places';
import { addRestaurant } from '@/src/db/repos/restaurants';
import { extractPlaces } from '@/src/lib/openai/server';
import { resolvePlaceByName, type ResolvedPlace } from '@/src/lib/google/resolvePlace';
import { requireUserAction, requireTripMember } from '@/src/lib/authz';

/** Valid place categories (schema enum); anything else coerces to 'other'. */
const CATEGORIES: ReadonlyArray<Place['category']> = [
  'sightseeing', 'lodging', 'hotel', 'airbnb', 'airport', 'transport',
  'activity', 'shopping', 'parking', 'entrance', 'museum', 'event', 'other',
];
function coerceCategory(s: string): Place['category'] {
  return (CATEGORIES as readonly string[]).includes(s) ? (s as Place['category']) : 'other';
}

const MAX_IMAGES = 8;

/** One proposed item shown in the import preview (extract → resolve → review). */
export interface ImportPreviewItem {
  type: 'restaurant' | 'place';
  name: string;
  address: string | null;
  /** AI-inferred region (kept for re-lookups / display). */
  area: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  cuisine: string;
  category: string;
  notes: string;
  /** Did Google find a match (coords + place id)? false → unmatched. */
  resolved: boolean;
}

/**
 * Extract places/restaurants from the user's pasted images + text (AI), then
 * resolve each name to a real Google place (address + coords + place id + cached
 * photo). Returns the proposals for the preview — creates nothing. Online-only.
 */
export async function extractImportItemsAction(input: {
  tripId: string;
  images: string[];
  text: string;
}): Promise<{ items: ImportPreviewItem[] }> {
  const principal = await requireUserAction();
  const tripId = z.string().min(1).parse(input.tripId);
  const trip = getTrip(db, tripId);
  if (!trip) throw new Error('Trip not found');
  requireTripMember(principal, tripId);

  const text = (input.text ?? '').slice(0, 20000);
  const images = (input.images ?? [])
    .filter((s) => typeof s === 'string' && s.startsWith('data:image/'))
    .slice(0, MAX_IMAGES);
  if (!text.trim() && images.length === 0) return { items: [] };

  const settings = getSettings(db);
  const tripContext = `${trip.name} (${trip.startDate} to ${trip.endDate})`;
  const extracted = await extractPlaces({ text, images, model: settings?.aiModel ?? null, tripContext });
  if (extracted.length === 0) return { items: [] };

  // Fallback region for items the model couldn't localize: the trip name minus
  // a trailing year ("Hawaii 2026" → "Hawaii").
  const regionHint = trip.name.replace(/\s*\d{4}\s*$/, '').trim();
  const apiKey = env.GOOGLE_MAPS_SERVER_KEY;

  const items: ImportPreviewItem[] = [];
  for (const e of extracted) {
    let resolved: ResolvedPlace | null = null;
    if (apiKey) {
      try {
        resolved = await resolvePlaceByName(db, {
          name: e.name,
          area: e.area || regionHint,
          apiKey,
          uploadsDir: env.UPLOADS_DIR,
        });
      } catch {
        resolved = null;
      }
    }
    items.push({
      type: e.type,
      name: resolved?.name || e.name,
      address: resolved?.address ?? (e.address || null),
      area: e.area,
      lat: resolved?.lat ?? null,
      lng: resolved?.lng ?? null,
      googlePlaceId: resolved?.googlePlaceId ?? null,
      cuisine: e.cuisine,
      category: e.category || (resolved?.categoryGuess ?? ''),
      notes: e.notes,
      resolved: resolved != null,
    });
  }
  return { items };
}

const createItemSchema = z.object({
  type: z.enum(['restaurant', 'place']),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  googlePlaceId: z.string().trim().min(1).max(300).nullish(),
  cuisine: z.string().trim().max(100).nullish(),
  category: z.string().trim().max(50).nullish(),
  notes: z.string().max(2000).nullish(),
});
export type ImportCreateItem = z.input<typeof createItemSchema>;

/**
 * Create the confirmed import items: restaurants → Eats (want-to-try), places →
 * Plan's Saved bucket. Coordinates + googlePlaceId carry through (so they map
 * and show the cached Google photo). Returns how many of each were created.
 */
export async function createImportItemsAction(input: {
  tripId: string;
  items: ImportCreateItem[];
}): Promise<{ restaurants: number; places: number }> {
  const principal = await requireUserAction();
  const tripId = z.string().min(1).parse(input.tripId);
  const trip = getTrip(db, tripId);
  if (!trip) throw new Error('Trip not found');
  requireTripMember(principal, tripId);
  const items = z.array(createItemSchema).parse(input.items ?? []);

  let restaurants = 0;
  let places = 0;
  for (const item of items) {
    if (item.type === 'restaurant') {
      addRestaurant(db, {
        tripId,
        name: item.name,
        cuisine: item.cuisine ?? null,
        rating: null,
        status: 'want-to-try',
        priceLevel: null,
        notes: item.notes ?? null,
        address: item.address ?? null,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        googlePlaceId: item.googlePlaceId ?? null,
        linkedPlaceId: null,
      });
      restaurants += 1;
    } else {
      addPlace(db, {
        tripId,
        dayDate: null, // Saved bucket
        name: item.name,
        address: item.address ?? null,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        googlePlaceId: item.googlePlaceId ?? null,
        category: coerceCategory(item.category ?? ''),
        notes: item.notes ?? null,
      });
      places += 1;
    }
  }
  if (restaurants > 0) revalidatePath(`/trip/${tripId}/eats`);
  if (places > 0) revalidatePath(`/trip/${tripId}/plan`);
  return { restaurants, places };
}
