import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { BudgetClient } from '@/components/budget/BudgetClient';

// Server-action modules reach into the DB client; stub them so this test can
// mount the REAL SetBudgetSheet (not a stub) in jsdom. setTargetAction just
// resolves — the post-save reload (below) is what surfaces the new target.
const setTargetAction = vi.fn().mockResolvedValue({});
vi.mock('@/app/_actions/budgetTargets', () => ({
  setTargetAction: (...a: unknown[]) => setTargetAction(...a),
  clearTargetAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/app/_actions/expenses', () => ({
  addExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  deleteExpenseAction: vi.fn(),
}));

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const placesBody = { places: [{ id: 'p1', name: 'Ichiran' }], legs: [] };

// The overall target the /budget endpoint reports — $100.00 on the first load,
// $200.00 on every reload afterwards (simulating the just-saved value).
let budgetFetchCount = 0;
function plannedForCall(): number {
  budgetFetchCount += 1;
  return budgetFetchCount === 1 ? 10000 : 20000;
}
function mockFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/budget')
      ? { expenses: [], targets: [{ id: 't0', tripId: 'trip-1', category: null, plannedAmount: plannedForCall(), createdAt: 0, updatedAt: 0 }] }
      : url.includes('/places')
        ? placesBody
        : { trip: { id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07', coverPhoto: null } };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

describe('BudgetClient → SetBudgetSheet remount', () => {
  beforeEach(() => {
    budgetFetchCount = 0;
    setTargetAction.mockClear();
    vi.stubGlobal('fetch', mockFetch());
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('re-reads the latest targets when the budget sheet is reopened after a save', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());

    // First open: pre-filled from the loaded target ($100.00).
    await userEvent.click(screen.getByRole('button', { name: en.budget.editBudget }));
    expect((screen.getByLabelText(en.budget.overallPlannedLabel) as HTMLInputElement).value).toBe('100.00');

    // Edit + save → onSaved closes the sheet and reloads (now reporting $200.00).
    fireEvent.change(screen.getByLabelText(en.budget.overallPlannedLabel), { target: { value: '150' } });
    await userEvent.click(screen.getByRole('button', { name: en.budget.save }));
    await waitFor(() => expect(setTargetAction).toHaveBeenCalled());

    // Wait for the reload to land (summary now shows the refreshed $200.00 plan)
    // before reopening, so the remount reads the new target rather than racing it.
    await waitFor(() => expect(screen.getByText(/\$0\.00 of \$200\.00/)).toBeInTheDocument());

    // Reopen: the key change must remount the sheet so it shows the refreshed
    // $200.00 — a persisted instance would still show the stale $100.00.
    await userEvent.click(screen.getByRole('button', { name: en.budget.editBudget }));
    await waitFor(() =>
      expect((screen.getByLabelText(en.budget.overallPlannedLabel) as HTMLInputElement).value).toBe('200.00'),
    );
  });
});
