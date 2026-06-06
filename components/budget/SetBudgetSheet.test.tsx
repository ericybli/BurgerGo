import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const setTargetAction = vi.fn();
const clearTargetAction = vi.fn();
vi.mock('@/app/_actions/budgetTargets', () => ({
  setTargetAction: (...a: unknown[]) => setTargetAction(...a),
  clearTargetAction: (...a: unknown[]) => clearTargetAction(...a),
}));

import { SetBudgetSheet } from '@/components/budget/SetBudgetSheet';
import type { TargetDTO } from '@/app/api/trips/[tripId]/budget/route';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const targets = [
  { id: 't0', tripId: 'trip-1', category: null, plannedAmount: 100000, createdAt: 0, updatedAt: 0 },
  { id: 't1', tripId: 'trip-1', category: 'food', plannedAmount: 30000, createdAt: 0, updatedAt: 0 },
] as unknown as TargetDTO[];

describe('SetBudgetSheet', () => {
  beforeEach(() => {
    setTargetAction.mockReset().mockResolvedValue({});
    clearTargetAction.mockReset().mockResolvedValue(undefined);
  });

  it('renders nothing when closed', () => {
    const { container } = renderWith(
      <SetBudgetSheet open={false} tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('pre-fills overall and category amounts in major units', () => {
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.budget.overallPlannedLabel) as HTMLInputElement).value).toBe('1000.00');
    const foodLabel = en.budget.categoryPlannedLabel.replace('{category}', en.budget.categories.food);
    expect((screen.getByLabelText(foodLabel) as HTMLInputElement).value).toBe('300.00');
  });

  it('saves changed targets and clears emptied ones', async () => {
    const onSaved = vi.fn();
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
    );
    // Change overall 1000 → 1200, clear food, set lodging to 500
    fireEvent.change(screen.getByLabelText(en.budget.overallPlannedLabel), { target: { value: '1200' } });
    const foodLabel = en.budget.categoryPlannedLabel.replace('{category}', en.budget.categories.food);
    fireEvent.change(screen.getByLabelText(foodLabel), { target: { value: '' } });
    const lodgingLabel = en.budget.categoryPlannedLabel.replace('{category}', en.budget.categories.lodging);
    fireEvent.change(screen.getByLabelText(lodgingLabel), { target: { value: '500' } });

    screen.getByRole('button', { name: en.budget.save }).click();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(setTargetAction).toHaveBeenCalledWith({ tripId: 'trip-1', category: null, plannedAmount: 120000 });
    expect(setTargetAction).toHaveBeenCalledWith({ tripId: 'trip-1', category: 'lodging', plannedAmount: 50000 });
    expect(clearTargetAction).toHaveBeenCalledWith('trip-1', 'food');
  });

  it('does not call any action for unchanged fields', async () => {
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={targets} currency="USD" locale="en" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    // Save with no edits: overall (100000) + food (30000) unchanged, others empty/never set.
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(setTargetAction).not.toHaveBeenCalled());
    expect(clearTargetAction).not.toHaveBeenCalled();
  });

  it('shows an inline error when an action rejects', async () => {
    setTargetAction.mockRejectedValueOnce(new Error('boom'));
    const onClose = vi.fn();
    renderWith(
      <SetBudgetSheet open tripId="trip-1" targets={[]} currency="USD" locale="en" disabled={false} onClose={onClose} onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(en.budget.overallPlannedLabel), { target: { value: '50' } });
    screen.getByRole('button', { name: en.budget.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.budget.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
  });
});
