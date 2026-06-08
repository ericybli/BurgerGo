'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { addList, renameList, deleteList, type SavedListRow } from '@/src/db/repos/savedLists';

const listName = z.string().trim().min(1, 'Name is required').max(100);

function revalidate(tripId: string): void {
  revalidatePath(`/trip/${tripId}/plan`);
}

export async function addSavedListAction(tripId: string, name: string): Promise<SavedListRow> {
  const id = z.string().min(1).parse(tripId);
  const trip = getTrip(db, id);
  if (!trip) throw new Error('Trip not found');
  const row = addList(db, id, listName.parse(name));
  revalidate(id);
  return row;
}

export async function renameSavedListAction(tripId: string, id: string, name: string): Promise<void> {
  const tId = z.string().min(1).parse(tripId);
  const lId = z.string().min(1).parse(id);
  renameList(db, lId, listName.parse(name));
  revalidate(tId);
}

export async function deleteSavedListAction(tripId: string, id: string): Promise<void> {
  const tId = z.string().min(1).parse(tripId);
  const lId = z.string().min(1).parse(id);
  deleteList(db, lId);
  revalidate(tId);
}
