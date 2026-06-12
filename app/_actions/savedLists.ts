'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { addList, renameList, deleteList, getList, type SavedListRow } from '@/src/db/repos/savedLists';
import { requireUserAction, requireTripMember } from '@/src/lib/authz';

const listName = z.string().trim().min(1, 'Name is required').max(100);

function revalidate(tripId: string): void {
  revalidatePath(`/trip/${tripId}/plan`);
}

export async function addSavedListAction(tripId: string, name: string): Promise<SavedListRow> {
  const principal = await requireUserAction();
  const id = z.string().min(1).parse(tripId);
  const trip = getTrip(db, id);
  if (!trip) throw new Error('Trip not found');
  requireTripMember(principal, id);
  const row = addList(db, id, listName.parse(name));
  revalidate(id);
  return row;
}

export async function renameSavedListAction(tripId: string, id: string, name: string): Promise<void> {
  const principal = await requireUserAction();
  const tId = z.string().min(1).parse(tripId);
  const lId = z.string().min(1).parse(id);
  requireTripMember(principal, tId);
  const list = getList(db, lId);
  if (!list || list.tripId !== tId) throw new Error('List not found');
  renameList(db, lId, listName.parse(name));
  revalidate(tId);
}

export async function deleteSavedListAction(tripId: string, id: string): Promise<void> {
  const principal = await requireUserAction();
  const tId = z.string().min(1).parse(tripId);
  const lId = z.string().min(1).parse(id);
  requireTripMember(principal, tId);
  const list = getList(db, lId);
  if (!list || list.tripId !== tId) throw new Error('List not found');
  deleteList(db, lId);
  revalidate(tId);
}
