import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { BudgetClient } from '@/components/budget/BudgetClient';

// Stub the sheets so this test focuses on data-owner behavior (fetch + render
// + toggle). The sheets have their own unit tests (C3.10/C3.11).
vi.mock('@/components/budget/ExpenseSheet', () => ({
  ExpenseSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="expense-sheet" /> : null,
}));
vi.mock('@/components/budget/SetBudgetSheet', () => ({
  SetBudgetSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="set-budget-sheet" /> : null,
}));

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const tripBody = { trip: { id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07', coverPhoto: null } };
const placesBody = {
  places: [{ id: 'p1', name: 'Ichiran' }],
  legs: [],
};
const budgetBody = {
  expenses: [
    { id: 'e1', tripId: 'trip-1', amount: 1500, category: 'food', spentOn: '2026-06-06', note: 'Ramen', linkedPlaceId: 'p1', placeName: 'Ichiran', createdAt: 0, updatedAt: 0 },
    { id: 'e2', tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05', note: null, linkedPlaceId: null, placeName: null, createdAt: 0, updatedAt: 0 },
  ],
  targets: [
    { id: 't0', tripId: 'trip-1', category: null, plannedAmount: 10000, createdAt: 0, updatedAt: 0 },
    { id: 't1', tripId: 'trip-1', category: 'food', plannedAmount: 30000, createdAt: 0, updatedAt: 0 },
  ],
  // Slim place options now ride along on the budget response (no separate /places fetch).
  places: [{ id: 'p1', name: 'Ichiran' }],
};

function mockFetchOk() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/budget')
      ? budgetBody
      : url.includes('/places')
        ? placesBody
        : tripBody;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

describe('BudgetClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchOk());
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('shows a loading state then renders the summary and expenses', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    expect(screen.getByText(en.budget.loading)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    // overall $35.00 of $100.00 (1500+2000 minor = 3500 → $35.00; plannedAmount 10000 → $100.00)
    expect(await screen.findByText(/\$35\.00 of \$100\.00/)).toBeInTheDocument();
    // expense rows
    expect(screen.getByText('Ramen')).toBeInTheDocument();
    expect(screen.getByText('Ichiran')).toBeInTheDocument(); // linked place chip
  });

  it('fetches only the budget read handler (place options ride along, no /places fetch)', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.endsWith('/api/trips/trip-1/budget'))).toBe(true);
    // P4: the heavy /places payload is no longer fetched just for {id,name}.
    expect(calls.some((u) => u.endsWith('/api/trips/trip-1/places'))).toBe(false);
  });

  it('groups by day by default and switches to by-category', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    // By day shows date group headers; newest first
    const dayBtn = screen.getByRole('button', { name: en.budget.byDay });
    expect(dayBtn).toHaveAttribute('aria-pressed', 'true');
    // switch to By category
    await userEvent.click(screen.getByRole('button', { name: en.budget.byCategory }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: en.budget.byCategory })).toHaveAttribute('aria-pressed', 'true'),
    );
    // category group headers visible (may appear in both summary + list)
    expect(screen.getAllByText(en.budget.categories.food).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.budget.categories.lodging).length).toBeGreaterThan(0);
  });

  it('opens the expense sheet from the add button', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: en.budget.addExpense }));
    expect(screen.getByTestId('expense-sheet')).toBeInTheDocument();
  });

  it('opens the set-budget sheet from the summary button', async () => {
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: en.budget.editBudget }));
    expect(screen.getByTestId('set-budget-sheet')).toBeInTheDocument();
  });

  it('disables the add button when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.overall)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: en.budget.addExpense })).toBeDisabled();
  });

  it('renders the error state when a fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)));
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.errorHeadline)).toBeInTheDocument());
  });

  it('shows the empty state when there are no expenses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.endsWith('/budget')
          ? { expenses: [], targets: [], places: [] }
          : url.includes('/places')
            ? placesBody
            : tripBody;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
      }),
    );
    renderWith(<BudgetClient tripId="trip-1" currency="USD" locale="en" />);
    await waitFor(() => expect(screen.getByText(en.budget.emptyHeadline)).toBeInTheDocument());
  });
});
