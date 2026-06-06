import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const addExpenseAction = vi.fn();
const updateExpenseAction = vi.fn();
const deleteExpenseAction = vi.fn();
vi.mock('@/app/_actions/expenses', () => ({
  addExpenseAction: (...a: unknown[]) => addExpenseAction(...a),
  updateExpenseAction: (...a: unknown[]) => updateExpenseAction(...a),
  deleteExpenseAction: (...a: unknown[]) => deleteExpenseAction(...a),
}));

import { ExpenseSheet } from '@/components/budget/ExpenseSheet';
import type { ExpenseDTO } from '@/app/api/trips/[tripId]/budget/route';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const places = [
  { id: 'p1', name: 'Ichiran' },
  { id: 'p2', name: 'Dotonbori' },
];

describe('ExpenseSheet', () => {
  beforeEach(() => {
    addExpenseAction.mockReset().mockResolvedValue({ id: 'e1' });
    updateExpenseAction.mockReset().mockResolvedValue({ id: 'e1' });
    deleteExpenseAction.mockReset().mockResolvedValue(undefined);
  });

  it('renders nothing when closed', () => {
    const { container } = renderWith(
      <ExpenseSheet open={false} tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('adds an expense converting major → minor units (USD exponent 2)', async () => {
    const onSaved = vi.fn();
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={onSaved} />,
    );
    fireEvent.change(screen.getByLabelText(en.budget.amountLabel), { target: { value: '15.30' } });
    fireEvent.change(screen.getByLabelText(en.budget.categoryLabel), { target: { value: 'food' } });
    fireEvent.change(screen.getByLabelText(en.budget.linkPlaceLabel), { target: { value: 'p1' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(addExpenseAction).toHaveBeenCalledTimes(1));
    expect(addExpenseAction).toHaveBeenCalledWith({
      tripId: 'trip-1',
      amount: 1530,
      category: 'food',
      spentOn: '2026-06-06',
      note: null,
      linkedPlaceId: 'p1',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('defaults the date to today and category to food', async () => {
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.budget.dateLabel) as HTMLInputElement).value).toBe('2026-06-06');
    expect((screen.getByLabelText(en.budget.categoryLabel) as HTMLSelectElement).value).toBe('food');
  });

  it('pre-fills + updates in edit mode and shows Delete', async () => {
    const expense = {
      id: 'e1', tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05',
      note: 'Hotel', linkedPlaceId: null, placeName: null,
      createdAt: 0, updatedAt: 0,
    } as unknown as ExpenseDTO;
    renderWith(
      <ExpenseSheet open tripId="trip-1" expense={expense} places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.budget.amountLabel) as HTMLInputElement).value).toBe('20.00');
    fireEvent.change(screen.getByLabelText(en.budget.amountLabel), { target: { value: '25' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(updateExpenseAction).toHaveBeenCalledTimes(1));
    expect(updateExpenseAction).toHaveBeenCalledWith('e1', expect.objectContaining({ amount: 2500, category: 'lodging' }));
    expect(screen.getByRole('button', { name: en.budget.delete })).toBeInTheDocument();
  });

  it('deletes in edit mode', async () => {
    const expense = {
      id: 'e1', tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05',
      note: null, linkedPlaceId: null, placeName: null, createdAt: 0, updatedAt: 0,
    } as unknown as ExpenseDTO;
    const onSaved = vi.fn();
    renderWith(
      <ExpenseSheet open tripId="trip-1" expense={expense} places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={onSaved} />,
    );
    screen.getByRole('button', { name: en.budget.delete }).click();
    await waitFor(() => expect(deleteExpenseAction).toHaveBeenCalledWith('e1'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an inline error and keeps the sheet open when the action rejects', async () => {
    addExpenseAction.mockRejectedValueOnce(new Error('boom'));
    const onClose = vi.fn();
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={onClose} onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(en.budget.amountLabel), { target: { value: '5' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.budget.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('rejects a zero/blank amount with the invalid-amount message, not saveFailed', async () => {
    renderWith(
      <ExpenseSheet open tripId="trip-1" places={places} currency="USD" locale="en" disabled={false} today="2026-06-06" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    // Blank amount → client-side validation, distinct from a server error.
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.budget.invalidAmount));
    expect(addExpenseAction).not.toHaveBeenCalled();

    // An explicit zero is rejected the same way.
    fireEvent.change(screen.getByLabelText(en.budget.amountLabel), { target: { value: '0' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.budget.invalidAmount));
    expect(addExpenseAction).not.toHaveBeenCalled();
  });
});
