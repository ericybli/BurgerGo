import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/components/packing/PackingClient', () => ({
  PackingClient: () => <div data-testid="packing-view" />,
}));
vi.mock('@/components/todo/TaskList', () => ({
  TaskList: () => <div data-testid="tasks-view" />,
}));

import { ToDoClient } from '@/components/todo/ToDoClient';

function renderTodo() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ToDoClient tripId="t1" />
    </NextIntlClientProvider>,
  );
}

describe('ToDoClient', () => {
  it('shows the Packing list by default and switches to Tasks', async () => {
    renderTodo();
    expect(screen.getByTestId('packing-view')).toBeInTheDocument();
    expect(screen.queryByTestId('tasks-view')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: en.todo.tasksTab }));
    expect(screen.getByTestId('tasks-view')).toBeInTheDocument();
    expect(screen.queryByTestId('packing-view')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: en.todo.packingTab }));
    expect(screen.getByTestId('packing-view')).toBeInTheDocument();
  });
});
