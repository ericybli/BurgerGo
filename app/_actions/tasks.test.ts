import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
}));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { addTaskAction, updateTaskAction, deleteTaskAction } from '@/app/_actions/tasks';
import { listByTrip, getTask } from '@/src/db/repos/tasks';

const TS = new Date('2026-06-08T12:00:00.000Z');
function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 't1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('task actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
  });

  it('adds a task (trimmed, done false, no note), appends in order, and revalidates', async () => {
    const a = await addTaskAction('t1', '  Book flights  ');
    expect(a.title).toBe('Book flights');
    expect(a.done).toBe(false);
    expect(a.note).toBeNull();
    await addTaskAction('t1', 'Pack bags');
    expect(listByTrip(testHandle.db, 't1').map((t) => t.title)).toEqual(['Book flights', 'Pack bags']);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/t1/packing');
  });

  it('rejects an empty title', async () => {
    await expect(addTaskAction('t1', '   ')).rejects.toThrow();
  });

  it('toggles done, sets + clears a note, and edits the title', async () => {
    const a = await addTaskAction('t1', 'X');
    expect((await updateTaskAction(a.id, { done: true })).done).toBe(true);
    expect((await updateTaskAction(a.id, { note: 'remember passport' })).note).toBe('remember passport');
    expect((await updateTaskAction(a.id, { title: 'Renamed' })).title).toBe('Renamed');
    expect((await updateTaskAction(a.id, { note: null })).note).toBeNull();
    // A done-only update must not wipe the title.
    expect((await updateTaskAction(a.id, { done: false })).title).toBe('Renamed');
  });

  it('deletes a task', async () => {
    const a = await addTaskAction('t1', 'X');
    await deleteTaskAction(a.id);
    expect(getTask(testHandle.db, a.id)).toBeUndefined();
  });

  it('throws when updating/deleting a missing task', async () => {
    await expect(updateTaskAction('nope', { done: true })).rejects.toThrow();
    await expect(deleteTaskAction('nope')).rejects.toThrow();
  });
});
