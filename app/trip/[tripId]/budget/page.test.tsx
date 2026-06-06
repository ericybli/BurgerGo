import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/src/env', () => ({ env: { DEFAULT_CURRENCY: 'JPY' } }));

// Stub BudgetClient so the page test asserts wiring (props), not the client.
const budgetClientProps = vi.fn();
vi.mock('@/components/budget/BudgetClient', () => ({
  BudgetClient: (props: Record<string, unknown>) => {
    budgetClientProps(props);
    return <div data-testid="budget-client" />;
  },
}));

import BudgetPage, { dynamic } from '@/app/trip/[tripId]/budget/page';

describe('BudgetPage (static shell)', () => {
  it('is force-static so the SW caches the shell for offline', () => {
    expect(dynamic).toBe('force-static');
  });

  it('renders BudgetClient with the trip id and env currency', async () => {
    const ui = await BudgetPage({ params: Promise.resolve({ tripId: 'trip-1' }) });
    render(ui);
    expect(screen.getByTestId('budget-client')).toBeInTheDocument();
    expect(budgetClientProps).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 'trip-1', currency: 'JPY', locale: 'en' }),
    );
  });
});
