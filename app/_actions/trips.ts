'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { createTrip, renameTrip, type Trip } from '@/src/db/repos/trips';

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
  const data = createSchema.parse(asObject(input));
  const trip = createTrip(db, data);
  revalidatePath('/');
  return trip;
}

const renameSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(200),
});

export async function renameTripAction(id: string, name: string): Promise<Trip> {
  const data = renameSchema.parse({ id, name });
  const updated = renameTrip(db, data.id, data.name);
  if (!updated) throw new Error('Trip not found');
  revalidatePath('/');
  return updated;
}
