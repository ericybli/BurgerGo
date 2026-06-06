import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/app/_actions/trips', () => ({
  createTripAction: vi.fn(),
  renameTripAction: vi.fn(),
}));

import { TripHeader } from './TripHeader';

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TripHeader tripId="t1" name="Tokyo adventure" dateSubtitle="May 3 – May 9" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('TripHeader', () => {
  it('renders the name, subtitle, and a back link to Home', () => {
    renderHeader();
    expect(screen.getByText('Tokyo adventure')).toBeInTheDocument();
    expect(screen.getByText('May 3 – May 9')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.trip.back }).getAttribute('href')).toBe('/');
  });

  it('opens the rename sheet when the name is tapped', async () => {
    renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Tokyo adventure' }));
    expect(screen.getByRole('dialog', { name: en.renameSheet.title })).toBeInTheDocument();
  });
});
