import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const planClientSpy = vi.fn();
vi.mock('@/components/plan/PlanClient', () => ({
  PlanClient: (props: Record<string, unknown>) => {
    planClientSpy(props);
    return <div data-testid="plan-client" />;
  },
}));

vi.mock('@/src/env', () => ({ env: { TZ: 'Asia/Tokyo', DEFAULT_CURRENCY: 'JPY' } }));

import PlanPage from './page';

describe('PlanPage', () => {
  it('renders PlanClient with tripId, tz, currency, and locale', async () => {
    const ui = await PlanPage({ params: Promise.resolve({ tripId: 't1' }) });
    render(ui);
    expect(screen.getByTestId('plan-client')).toBeInTheDocument();
    expect(planClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', tz: 'Asia/Tokyo', currency: 'JPY', locale: 'en' }),
    );
  });
});
