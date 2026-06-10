'use server';

import { z } from 'zod';
import { rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import {
  addTicket,
  updateTicket,
  deleteTicket,
  getTicket,
  getTicketFile,
  deleteTicketFile,
  listFilesForTicket,
  type Ticket,
} from '@/src/db/repos/tickets';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');

const addSchema = z.object({
  tripId: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(200),
  date: dateStr.nullish(),
  time: timeStr.nullish(),
  location: z.string().trim().max(300).nullish(),
  note: z.string().max(2000).nullish(),
});

export type AddTicketActionInput = z.input<typeof addSchema>;

function revalidateTickets(tripId: string): void {
  revalidatePath(`/trip/${tripId}/tickets`);
}

/** Uploads-root path guard (mirrors deletePhotoAction). */
function isUnderUploads(absPath: string): boolean {
  const root = resolve(env.UPLOADS_DIR);
  return resolve(absPath).startsWith(root + sep);
}

export async function addTicketAction(input: AddTicketActionInput): Promise<Ticket> {
  const data = addSchema.parse(input);
  if (!getTrip(db, data.tripId)) throw new Error('Trip not found');
  const row = addTicket(db, {
    tripId: data.tripId,
    title: data.title,
    date: data.date ?? null,
    time: data.time ?? null,
    location: data.location ?? null,
    note: data.note ?? null,
  });
  revalidateTickets(data.tripId);
  return row;
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  date: dateStr.nullish(),
  time: timeStr.nullish(),
  location: z.string().trim().max(300).nullish(),
  note: z.string().max(2000).nullish(),
});

export type UpdateTicketActionPatch = z.input<typeof updateSchema>;

export async function updateTicketAction(
  id: string,
  patch: UpdateTicketActionPatch,
): Promise<Ticket> {
  const existing = getTicket(db, id);
  if (!existing) throw new Error('Ticket not found');
  const data = updateSchema.parse(patch);
  const updated = updateTicket(db, id, data);
  if (!updated) throw new Error('Ticket not found');
  revalidateTickets(existing.tripId);
  return updated;
}

/** Delete a ticket + every attachment's bytes on disk (rows cascade). */
export async function deleteTicketAction(id: string): Promise<void> {
  const existing = getTicket(db, id);
  if (!existing) throw new Error('Ticket not found');
  for (const f of listFilesForTicket(db, id)) {
    const abs = join(env.UPLOADS_DIR, f.path);
    if (isUnderUploads(abs)) await rm(abs, { force: true });
  }
  // Remove the (now empty) per-ticket dir too; force → no throw if missing.
  const dir = join(env.UPLOADS_DIR, 'tickets', existing.id);
  if (isUnderUploads(dir)) await rm(dir, { recursive: true, force: true });
  deleteTicket(db, id);
  revalidateTickets(existing.tripId);
}

/** Delete one attachment (row + bytes). */
export async function deleteTicketFileAction(fileId: string): Promise<void> {
  const file = getTicketFile(db, fileId);
  if (!file) throw new Error('File not found');
  const abs = join(env.UPLOADS_DIR, file.path);
  if (isUnderUploads(abs)) await rm(abs, { force: true });
  deleteTicketFile(db, fileId);
  revalidateTickets(file.tripId);
}
