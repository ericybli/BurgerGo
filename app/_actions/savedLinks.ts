'use server';

import { z } from 'zod';
import { rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import {
  getLink,
  addLink,
  updateLink,
  deleteLink,
  type SavedLink,
} from '@/src/db/repos/savedLinks';
import { isHttpUrl } from '@/src/lib/linkPreview';
import { requireUserAction, requireTripMember } from '@/src/lib/authz';

function revalidateJournal(tripId: string): void {
  revalidatePath(`/trip/${tripId}/journal`);
}

const urlField = z.string().min(1).refine(isHttpUrl, 'Must be an http(s) URL');

// --- addLinkAction --------------------------------------------------------

const addSchema = z.object({
  tripId: z.string().min(1),
  url: urlField,
  title: z.string().max(2000).nullish(),
  note: z.string().max(4000).nullish(),
  thumbnail: z.string().max(1000).nullish(),
  placeId: z.string().min(1).nullish(),
});

export type AddLinkActionInput = z.input<typeof addSchema>;

export async function addLinkAction(input: AddLinkActionInput): Promise<SavedLink> {
  const principal = await requireUserAction();
  const data = addSchema.parse(input);
  requireTripMember(principal, data.tripId);
  const link = addLink(db, {
    tripId: data.tripId,
    url: data.url,
    title: data.title ?? null,
    note: data.note ?? null,
    thumbnail: data.thumbnail ?? null,
    placeId: data.placeId ?? null,
  });
  if (data.placeId) revalidatePath(`/trip/${data.tripId}/plan`);
  else revalidateJournal(data.tripId);
  return link;
}

// --- updateLinkAction -----------------------------------------------------

const updateSchema = z.object({
  url: urlField.optional(),
  title: z.string().max(2000).nullish(),
  note: z.string().max(4000).nullish(),
  thumbnail: z.string().max(1000).nullish(),
});

export type UpdateLinkActionPatch = z.input<typeof updateSchema>;

export async function updateLinkAction(
  id: string,
  patch: UpdateLinkActionPatch,
): Promise<SavedLink> {
  const principal = await requireUserAction();
  const existing = getLink(db, id);
  if (!existing) throw new Error('Link not found');
  requireTripMember(principal, existing.tripId);
  const data = updateSchema.parse(patch);
  const updated = updateLink(db, id, data);
  if (!updated) throw new Error('Link not found');
  revalidateJournal(existing.tripId);
  return updated;
}

// --- deleteLinkAction -----------------------------------------------------

export async function deleteLinkAction(id: string): Promise<void> {
  const principal = await requireUserAction();
  const existing = getLink(db, id);
  if (!existing) throw new Error('Link not found');
  requireTripMember(principal, existing.tripId);

  // Best-effort thumbnail cleanup. Guard against a path-traversal attack via a
  // tampered `thumbnail` column: the resolved file must be strictly *under* the
  // uploads root — never the root itself (an empty path would otherwise target
  // UPLOADS_DIR). Mirrors the Plan-2 photo-delete guard.
  if (existing.thumbnail) {
    const absPath = join(env.UPLOADS_DIR, existing.thumbnail);
    const root = resolve(env.UPLOADS_DIR);
    if (resolve(absPath).startsWith(root + sep)) {
      await rm(absPath, { force: true });
    }
  }

  deleteLink(db, id);
  // Place-scoped links surface in the Plan tab; reading-list links in Journal.
  if (existing.placeId) revalidatePath(`/trip/${existing.tripId}/plan`);
  else revalidateJournal(existing.tripId);
}
