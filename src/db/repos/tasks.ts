import { asc, eq, max } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { tasks, type Task } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Task };

type Db = TestDb['db'];

/** One task by id, or undefined. */
export function getTask(db: Db, id: string): Task | undefined {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

/** All tasks for a trip, in creation order (orderIndex ascending). */
export function listByTrip(db: Db, tripId: string): Task[] {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.tripId, tripId))
    .orderBy(asc(tasks.orderIndex))
    .all();
}

/** Highest orderIndex for a trip's tasks, or -1 when empty. */
function maxOrderIndex(db: Db, tripId: string): number {
  const row = db
    .select({ m: max(tasks.orderIndex) })
    .from(tasks)
    .where(eq(tasks.tripId, tripId))
    .get();
  return row?.m ?? -1;
}

/** Insert a task (title only); note null, done false, appended to the end. */
export function addTask(db: Db, tripId: string, title: string): Task {
  const ts = new Date(now());
  const row: Task = {
    id: newId(),
    tripId,
    title,
    note: null,
    done: false,
    orderIndex: maxOrderIndex(db, tripId) + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(tasks).values(row).run();
  return row;
}

/** Editable subset of a task. */
export type TaskPatch = Partial<Pick<Task, 'title' | 'note' | 'done'>>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateTask(db: Db, id: string, patch: TaskPatch): Task | undefined {
  db.update(tasks)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(tasks.id, id))
    .run();
  return getTask(db, id);
}

/** Delete a task. */
export function deleteTask(db: Db, id: string): void {
  db.delete(tasks).where(eq(tasks.id, id)).run();
}
