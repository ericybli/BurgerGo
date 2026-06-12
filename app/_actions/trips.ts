'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { createTrip, renameTrip, getTrip, updateTripDates, setCover, deleteTrip, type Trip } from '@/src/db/repos/trips';
import { shiftDayDates, unscheduleDay } from '@/src/db/repos/places';
import { ensureOwner, listMembers } from '@/src/db/repos/tripMembers';
import { addDays, diffDays } from '@/src/lib/days';
import { requireUserAction, requireTripMember } from '@/src/lib/authz';
import { env } from '@/src/env';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const createSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    startDate: dateStr,
    endDate: dateStr,
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

function asObject(input: FormData | Record<string, unknown>) {
  if (input instanceof FormData) {
    return {
      name: input.get('name'),
      startDate: input.get('startDate'),
      endDate: input.get('endDate'),
    };
  }
  return input;
}

export async function createTripAction(
  input: FormData | { name: string; startDate: string; endDate: string },
): Promise<Trip> {
  const principal = await requireUserAction();
  const data = createSchema.parse(asObject(input));
  const trip = createTrip(db, data);
  // The creator owns the trip. Machine creates (scripts/MCP) fall back to the
  // configured owner email; if even that is unset the seed script will adopt it.
  const ownerEmail = principal.kind === 'user' ? principal.email : env.BURGERGO_OWNER_EMAIL;
  if (ownerEmail) ensureOwner(db, trip.id, ownerEmail);
  revalidatePath('/');
  return trip;
}

const renameSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(200),
});

export async function renameTripAction(id: string, name: string): Promise<Trip> {
  const principal = await requireUserAction();
  const data = renameSchema.parse({ id, name });
  requireTripMember(principal, data.id);
  const updated = renameTrip(db, data.id, data.name);
  if (!updated) throw new Error('Trip not found');
  revalidatePath('/');
  return updated;
}

function revalidateTrip(id: string): void {
  revalidatePath('/');
  revalidatePath(`/trip/${id}/plan`);
}

// --- setTripCoverAction ----------------------------------------------------

/**
 * Set or clear (pass null) a trip's cover photo path. Returns the updated row.
 * The path is stored as-is (a `photos`-relative reference); pass `null` to clear.
 */
export async function setTripCoverAction(id: string, coverPhoto: string | null): Promise<Trip> {
  const principal = await requireUserAction();
  const data = z
    .object({ id: z.string().min(1), coverPhoto: z.string().min(1).nullable() })
    .parse({ id, coverPhoto });
  requireTripMember(principal, data.id);
  const updated = setCover(db, data.id, data.coverPhoto);
  if (!updated) throw new Error('Trip not found');
  revalidateTrip(data.id);
  return updated;
}

// --- deleteTripAction ------------------------------------------------------

/**
 * Delete a trip (child rows cascade via FK). Throws if the trip is missing.
 * Owner-only for user principals; machine principals (scripts/MCP) bypass.
 */
export async function deleteTripAction(id: string): Promise<void> {
  const principal = await requireUserAction();
  const tripId = z.string().min(1).parse(id);
  if (!getTrip(db, tripId)) throw new Error('Trip not found');
  requireTripMember(principal, tripId);
  if (principal.kind === 'user') {
    const me = listMembers(db, tripId).find((m) => m.userId === principal.userId);
    if (me?.role !== 'owner') throw new Error('Only the owner can delete the trip');
  }
  deleteTrip(db, tripId);
  revalidateTrip(tripId);
}

// --- shiftTripDatesAction --------------------------------------------------

/**
 * Move the whole trip window to start on `newStartDate`, keeping its length.
 * Every scheduled place shifts by the same delta so it stays on the same
 * relative day (Saved places are untouched).
 */
export async function shiftTripDatesAction(id: string, newStartDate: string): Promise<Trip> {
  const principal = await requireUserAction();
  const data = z.object({ id: z.string().min(1), startDate: dateStr }).parse({ id, startDate: newStartDate });
  const trip = getTrip(db, data.id);
  if (!trip) throw new Error('Trip not found');
  requireTripMember(principal, data.id);
  const delta = diffDays(trip.startDate, data.startDate);
  if (delta === 0) return trip;
  shiftDayDates(db, data.id, delta);
  const updated = updateTripDates(db, data.id, {
    startDate: data.startDate,
    endDate: addDays(trip.endDate, delta),
  });
  if (!updated) throw new Error('Trip not found');
  revalidateTrip(data.id);
  return updated;
}

// --- addTripDayAction ------------------------------------------------------

/** Extend the trip by one day at the end. */
export async function addTripDayAction(id: string): Promise<Trip> {
  const principal = await requireUserAction();
  const tripId = z.string().min(1).parse(id);
  const trip = getTrip(db, tripId);
  if (!trip) throw new Error('Trip not found');
  requireTripMember(principal, tripId);
  const updated = updateTripDates(db, tripId, { startDate: trip.startDate, endDate: addDays(trip.endDate, 1) });
  if (!updated) throw new Error('Trip not found');
  revalidateTrip(tripId);
  return updated;
}

// --- removeTripDayAction ---------------------------------------------------

/**
 * Shorten the trip by one day at the end. Any places on the removed last day
 * move to the Saved bucket (never deleted). Blocked when the trip is one day.
 */
export async function removeTripDayAction(id: string): Promise<Trip> {
  const principal = await requireUserAction();
  const tripId = z.string().min(1).parse(id);
  const trip = getTrip(db, tripId);
  if (!trip) throw new Error('Trip not found');
  requireTripMember(principal, tripId);
  if (trip.startDate === trip.endDate) throw new Error('A trip needs at least one day');
  unscheduleDay(db, tripId, trip.endDate); // preserve last-day places in Saved
  const updated = updateTripDates(db, tripId, { startDate: trip.startDate, endDate: addDays(trip.endDate, -1) });
  if (!updated) throw new Error('Trip not found');
  revalidateTrip(tripId);
  return updated;
}
