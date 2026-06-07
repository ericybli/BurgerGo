'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getRestaurant,
  scheduleRestaurantToDay,
  unscheduleRestaurant,
  type Restaurant,
} from '@/src/db/repos/restaurants';
import type { Place } from '@/src/db/repos/places';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const status = z.enum(['want-to-try', 'been']);
const rating = z.number().int().min(1).max(5);
const priceLevel = z.number().int().min(1).max(4);

function revalidateEats(tripId: string): void {
  revalidatePath(`/trip/${tripId}/eats`);
}

// --- addRestaurantAction --------------------------------------------------

const address = z.string().trim().max(500).nullish();
const lat = z.number().min(-90).max(90).nullish();
const lng = z.number().min(-180).max(180).nullish();
const googlePlaceId = z.string().trim().min(1).max(300).nullish();

const addSchema = z.object({
  tripId: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(200),
  cuisine: z.string().trim().max(100).nullish(),
  rating: rating.nullish(),
  status,
  priceLevel: priceLevel.nullish(),
  notes: z.string().max(2000).nullish(),
  address,
  lat,
  lng,
  googlePlaceId,
  linkedPlaceId: z.string().min(1).nullish(),
});

export type AddRestaurantActionInput = z.input<typeof addSchema>;

export async function addRestaurantAction(input: AddRestaurantActionInput): Promise<Restaurant> {
  const data = addSchema.parse(input);
  const r = addRestaurant(db, {
    tripId: data.tripId,
    name: data.name,
    cuisine: data.cuisine ?? null,
    rating: data.rating ?? null,
    status: data.status,
    priceLevel: data.priceLevel ?? null,
    notes: data.notes ?? null,
    address: data.address ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    googlePlaceId: data.googlePlaceId ?? null,
    linkedPlaceId: data.linkedPlaceId ?? null,
  });
  revalidateEats(data.tripId);
  return r;
}

// --- updateRestaurantAction -----------------------------------------------

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  cuisine: z.string().trim().max(100).nullish(),
  rating: rating.nullish(),
  status: status.optional(),
  priceLevel: priceLevel.nullish(),
  notes: z.string().max(2000).nullish(),
  address,
  lat,
  lng,
  googlePlaceId,
});

export type UpdateRestaurantActionPatch = z.input<typeof updateSchema>;

export async function updateRestaurantAction(
  id: string,
  patch: UpdateRestaurantActionPatch,
): Promise<Restaurant> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  const data = updateSchema.parse(patch);
  const updated = updateRestaurant(db, id, data);
  if (!updated) throw new Error('Restaurant not found');
  revalidateEats(existing.tripId);
  return updated;
}

// --- deleteRestaurantAction -----------------------------------------------

export async function deleteRestaurantAction(id: string): Promise<void> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  deleteRestaurant(db, id);
  revalidateEats(existing.tripId);
}

// --- scheduleRestaurantToDayAction ----------------------------------------

export async function scheduleRestaurantToDayAction(
  id: string,
  dayDate: string,
): Promise<{ restaurant: Restaurant; place: Place }> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  const parsedDay = dateStr.parse(dayDate);
  const result = scheduleRestaurantToDay(db, id, parsedDay);
  revalidateEats(existing.tripId);
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return result;
}

// --- unscheduleRestaurantAction -------------------------------------------

export async function unscheduleRestaurantAction(id: string): Promise<Restaurant> {
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  const updated = unscheduleRestaurant(db, id);
  if (!updated) throw new Error('Restaurant not found');
  revalidateEats(existing.tripId);
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return updated;
}
