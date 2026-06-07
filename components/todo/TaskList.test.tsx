import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { Task } from '@/src/db/repos/tasks';

const addTaskAction = vi.fn(async () => ({}) as Task);
const updateTaskAction = vi.fn(async () => ({}) as Task);
const deleteTaskAction = vi.fn(async () => undefined);
vi.mock('@/app/_actions/tasks', () => ({
  addTaskAction: (...a: unknown[]) => addTaskAction(...(a as [])),
  updateTaskAction: (...a: unknown[]) => updateTaskAction(...(a as [])),
  deleteTaskAction: (...a: unknown[]) => deleteTaskAction(...(a as [])),
}));

import { TaskList } from '@/components/todo/TaskList';

const TS = new Date(0);
function task(over: Partial<Task> = {}): Task {
  return { id: 'k1', tripId: 't1', title: 'Book flights', note: null, done: false, orderIndex: 0, createdAt: TS, updatedAt: TS, ...over };
}

function mockFetch(tasks: Task[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tasks }) })) as unknown as typeof fetch);
}

beforeEach(() => {
  addTaskAction.mockClear();
  updateTaskAction.mockClear();
  deleteTaskAction.mockClear();
});

function renderList() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TaskList tripId="t1" />
    </NextIntlClientProvider>,
  );
}

describe('TaskList', () => {
  it('adds a task via the input', async () => {
    mockFetch([]);
    renderList();
    const input = await screen.findByPlaceholderText(en.tasks.taskPlaceholder);
    await userEvent.type(input, 'Pack bags');
    await userEvent.click(screen.getByRole('button', { name: en.tasks.addTask }));
    await waitFor(() => expect(addTaskAction).toHaveBeenCalledWith('t1', 'Pack bags'));
  });

  it('renders a task, toggles done via the checkbox, and deletes it', async () => {
    mockFetch([task()]);
    renderList();
    await screen.findByDisplayValue('Book flights');
    await userEvent.click(screen.getByRole('checkbox', { name: /Book flights/ }));
    expect(updateTaskAction).toHaveBeenCalledWith('k1', { done: true });
    await userEvent.click(screen.getByRole('button', { name: en.tasks.deleteTask }));
    expect(deleteTaskAction).toHaveBeenCalledWith('k1');
  });

  it('saves a note on blur', async () => {
    mockFetch([task()]);
    renderList();
    const note = await screen.findByPlaceholderText(en.tasks.notePlaceholder);
    await userEvent.type(note, 'remember passport');
    await userEvent.tab(); // blur
    await waitFor(() => expect(updateTaskAction).toHaveBeenCalledWith('k1', { note: 'remember passport' }));
  });

  it('shows the empty state when there are no tasks', async () => {
    mockFetch([]);
    renderList();
    expect(await screen.findByText(en.tasks.emptyHeadline)).toBeInTheDocument();
  });
});
