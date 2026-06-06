'use server';

import { z } from 'zod';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getPhoto, deletePhoto } from '@/src/db/repos/photos';

const photoId = z.string().min(1);

/**
 * Delete a personal photo: remove its on-disk derivatives dir, delete the row,
 * and revalidate the owning trip's Plan tab. Online-only (a Server Action).
 */
export async function deletePhotoAction(id: string): Promise<void> {
  const parsed = photoId.parse(id);
  const existing = getPhoto(db, parsed);
  if (!existing) throw new Error('Photo not found');

  // Best-effort disk cleanup (force:true → no throw if already gone).
  await rm(join(env.UPLOADS_DIR, existing.path), { recursive: true, force: true });

  deletePhoto(db, parsed);
  revalidatePath(`/trip/${existing.tripId}/plan`);
}
