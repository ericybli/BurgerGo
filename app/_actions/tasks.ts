'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  addTask,
  updateTask,
  deleteTask,
  getTask,
  type Task,
} from '@/src/db/repos/tasks';

const titleField = z.string().trim().min(1, 'Title is required').max(300);

function revalidateTasks(tripId: string): void {
  // The Tasks section lives under the /packing ("To do") route.
  revalidatePath(`/trip/${tripId}/packing`);
}

export async function addTaskAction(tripId: string, rawTitle: string): Promise<Task> {
  const trip = z.string().min(1).parse(tripId);
  const title = titleField.parse(rawTitle);
  const task = addTask(db, trip, title);
  revalidateTasks(trip);
  return task;
}

const updateSchema = z.object({
  title: titleField.optional(),
  note: z.string().max(2000).nullish(),
  done: z.boolean().optional(),
});

export type UpdateTaskActionPatch = z.input<typeof updateSchema>;

export async function updateTaskAction(id: string, patch: UpdateTaskActionPatch): Promise<Task> {
  const existing = getTask(db, id);
  if (!existing) throw new Error('Task not found');
  const data = updateSchema.parse(patch);
  const updated = updateTask(db, id, {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...('note' in data ? { note: data.note ?? null } : {}),
    ...(data.done !== undefined ? { done: data.done } : {}),
  });
  if (!updated) throw new Error('Task not found');
  revalidateTasks(existing.tripId);
  return updated;
}

export async function deleteTaskAction(id: string): Promise<void> {
  const existing = getTask(db, id);
  if (!existing) throw new Error('Task not found');
  deleteTask(db, id);
  revalidateTasks(existing.tripId);
}
