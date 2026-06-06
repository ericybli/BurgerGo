import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const eatsClientSpy = vi.fn();
vi.mock('@/components/eats/EatsClient', () => ({
  EatsClient: (props: Record<string, unknown>) => {
    eatsClientSpy(props);
    return <div data-testid="eats-client" />;
  },
}));

vi.mock('@/src/env', () => ({ env: { TZ: 'Asia/Tokyo', DEFAULT_CURRENCY: 'JPY' } }));

import EatsPage from './page';

describe('EatsPage', () => {
  it('renders EatsClient with tripId, tz, currency, and locale', async () => {
    const ui = await EatsPage({ params: Promise.resolve({ tripId: 't1' }) });
    render(ui);
    expect(screen.getByTestId('eats-client')).toBeInTheDocument();
    expect(eatsClientSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', tz: 'Asia/Tokyo', currency: 'JPY', locale: 'en' }),
    );
  });
});
