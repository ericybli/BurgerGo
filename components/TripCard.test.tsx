import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { TripCard } from './TripCard';
import type { Trip } from '@/src/db/schema';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Tokyo adventure',
    startDate: '2026-05-03',
    endDate: '2026-05-09',
    coverPhoto: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  } as Trip;
}

function renderCard(trip: Trip) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TripCard trip={trip} tz="UTC" />
    </NextIntlClientProvider>,
  );
}

describe('TripCard', () => {
  it('links to the trip and shows its name + day count', () => {
    // Future trip relative to a fixed today; status pill = Upcoming.
    vi.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00Z'));
    renderCard(makeTrip());
    expect(screen.getByText('Tokyo adventure')).toBeInTheDocument();
    expect(screen.getByText(/· 7 days/)).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/trip/t1');
    vi.useRealTimers();
  });

  it('shows the Upcoming pill for a future trip', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00Z'));
    renderCard(makeTrip());
    expect(screen.getByText(en.status.upcoming)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows the Active pill when today is within the date range', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-05-05T12:00:00Z'));
    renderCard(makeTrip());
    expect(screen.getByText(en.status.active)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows the Past pill for a finished trip', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-06-01T12:00:00Z'));
    renderCard(makeTrip());
    expect(screen.getByText(en.status.past)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
