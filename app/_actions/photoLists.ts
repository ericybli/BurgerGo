'use server';

import { z } from 'zod';
import { rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import {
  addPhotoList,
  renamePhotoList,
  deletePhotoList,
  getPhotoList,
  type PhotoList,
} from '@/src/db/repos/photoLists';
import { listByOwner, deletePhoto } from '@/src/db/repos/photos';

const listName = z.string().trim().min(1, 'Name is required').max(100);

function revalidate(tripId: string): void {
  revalidatePath(`/trip/${tripId}/journal`);
}

/** Create a named photography list for a trip. */
export async function addPhotoListAction(tripId: string, name: string): Promise<PhotoList> {
  const id = z.string().min(1).parse(tripId);
  const trip = getTrip(db, id);
  if (!trip) throw new Error('Trip not found');
  const row = addPhotoList(db, id, listName.parse(name));
  revalidate(id);
  return row;
}

/** Rename a photography list. */
export async function renamePhotoListAction(tripId: string, id: string, name: string): Promise<void> {
  const tId = z.string().min(1).parse(tripId);
  const lId = z.string().min(1).parse(id);
  renamePhotoList(db, lId, listName.parse(name));
  revalidate(tId);
}

/**
 * Delete a photography list and all its photos. The generic `photos.owner_id`
 * has no DB-level FK to cascade from `photo_lists`, so we explicitly remove each
 * photo's on-disk derivatives + row (mirroring deletePhotoAction's path guard),
 * then the list row.
 */
export async function deletePhotoListAction(tripId: string, id: string): Promise<void> {
  const tId = z.string().min(1).parse(tripId);
  const lId = z.string().min(1).parse(id);
  const list = getPhotoList(db, lId);
  if (!list || list.tripId !== tId) throw new Error('List not found');

  const root = resolve(env.UPLOADS_DIR);
  for (const photo of listByOwner(db, 'photo_list', lId)) {
    const absPath = join(env.UPLOADS_DIR, photo.path);
    // Must be strictly *under* the uploads root (guard against a tampered path).
    if (resolve(absPath).startsWith(root + sep)) {
      await rm(absPath, { recursive: true, force: true });
    }
    deletePhoto(db, photo.id);
  }
  deletePhotoList(db, lId);
  revalidate(tId);
}
