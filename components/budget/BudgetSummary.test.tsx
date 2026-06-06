import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import type { BudgetRow } from '@/src/lib/budgetView';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const overall: BudgetRow = {
  category: 'overall', spent: 3800, planned: 10000, remaining: 6200, over: false, percent: 38,
};
const rows: BudgetRow[] = [
  { category: 'food', spent: 1500, planned: 2000, remaining: 500, over: false, percent: 75 },
  { category: 'lodging', spent: 2000, planned: 1500, remaining: -500, over: true, percent: 133 },
  { category: 'transport', spent: 300, planned: null, remaining: null, over: false, percent: null },
];

describe('BudgetSummary', () => {
  it('renders the overall block with spent of planned and remaining', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    expect(screen.getByText(en.budget.overall)).toBeInTheDocument();
    // formatMoney(3800,'USD') = $38.00 ; planned $100.00
    expect(screen.getByText(/\$38\.00 of \$100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$62\.00 left/)).toBeInTheDocument();
  });

  it('shows an over-budget category with the over amount', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    expect(screen.getByText(en.budget.categories.lodging)).toBeInTheDocument();
    // remaining -500 minor → $5.00 over
    expect(screen.getByText(/\$5\.00 over/)).toBeInTheDocument();
  });

  it('shows "No budget set" for a category with no target', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    expect(screen.getByText(en.budget.categories.transport)).toBeInTheDocument();
    expect(screen.getAllByText(en.budget.noTarget).length).toBeGreaterThan(0);
  });

  it('sets progress-bar width from clamped percent (133% → 100%)', () => {
    renderWith(
      <BudgetSummary overall={overall} categories={rows} currency="USD" locale="en" onSetBudget={vi.fn()} />,
    );
    const lodgingBar = screen.getByTestId('bar-lodging');
    expect(lodgingBar).toHaveStyle({ width: '100%' });
    const foodBar = screen.getByTestId('bar-food');
    expect(foodBar).toHaveStyle({ width: '75%' });
  });

  it('fires onSetBudget when the set-budget button is pressed', async () => {
    const onSetBudget = vi.fn();
    renderWith(
      <BudgetSummary overall={{ ...overall, planned: null, remaining: null, percent: null }} categories={rows} currency="USD" locale="en" onSetBudget={onSetBudget} />,
    );
    screen.getByRole('button', { name: en.budget.setBudget }).click();
    expect(onSetBudget).toHaveBeenCalledTimes(1);
  });
});
