'use server';

import { z } from 'zod';
import { rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import {
  getEntry,
  addEntry,
  updateEntry,
  deleteEntry,
  type JournalEntry,
} from '@/src/db/repos/journalEntries';
import { listByOwner, deletePhoto } from '@/src/db/repos/photos';
import { requireUserAction, requireTripMember } from '@/src/lib/authz';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const title = z.string().trim().min(1, 'Title is required');
const body = z.string().max(50_000);

function revalidateJournal(tripId: string): void {
  revalidatePath(`/trip/${tripId}/journal`);
}

// --- addEntryAction -------------------------------------------------------

const addSchema = z.object({
  tripId: z.string().min(1),
  title,
  body,
  entryDate: dateStr.nullish(),
});

export type AddEntryActionInput = z.input<typeof addSchema>;

export async function addEntryAction(input: AddEntryActionInput): Promise<JournalEntry> {
  const principal = await requireUserAction();
  const data = addSchema.parse(input);
  requireTripMember(principal, data.tripId);
  const entry = addEntry(db, {
    tripId: data.tripId,
    title: data.title,
    body: data.body,
    entryDate: data.entryDate ?? null,
  });
  revalidateJournal(data.tripId);
  return entry;
}

// --- updateEntryAction ----------------------------------------------------

const updateSchema = z.object({
  title: title.optional(),
  body: body.optional(),
  entryDate: dateStr.nullish(),
});

export type UpdateEntryActionPatch = z.input<typeof updateSchema>;

export async function updateEntryAction(
  id: string,
  patch: UpdateEntryActionPatch,
): Promise<JournalEntry> {
  const principal = await requireUserAction();
  const existing = getEntry(db, id);
  if (!existing) throw new Error('Entry not found');
  requireTripMember(principal, existing.tripId);
  const data = updateSchema.parse(patch);
  const updated = updateEntry(db, id, data);
  if (!updated) throw new Error('Entry not found');
  revalidateJournal(existing.tripId);
  return updated;
}

// --- deleteEntryAction ----------------------------------------------------

/**
 * Delete an entry and its journal photos: remove each photo's on-disk
 * derivative dir (path-traversal-guarded, strictly *under* the uploads root —
 * never the root itself), delete the photo rows, then the entry, then
 * revalidate. Online-only (a Server Action). Mirrors deletePhotoAction's guard.
 */
export async function deleteEntryAction(id: string): Promise<void> {
  const principal = await requireUserAction();
  const existing = getEntry(db, id);
  if (!existing) throw new Error('Entry not found');
  requireTripMember(principal, existing.tripId);

  const root = resolve(env.UPLOADS_DIR);
  const galleryPhotos = listByOwner(db, 'journal', id);
  for (const photo of galleryPhotos) {
    const absPath = join(env.UPLOADS_DIR, photo.path);
    if (!resolve(absPath).startsWith(root + sep)) {
      throw new Error('Invalid photo path');
    }
    // Best-effort disk cleanup (force:true → no throw if already gone).
    await rm(absPath, { recursive: true, force: true });
    deletePhoto(db, photo.id);
  }

  deleteEntry(db, id);
  revalidateJournal(existing.tripId);
}
