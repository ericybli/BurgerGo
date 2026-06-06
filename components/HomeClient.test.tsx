import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { Trip } from '@/src/db/schema';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/app/_actions/trips', () => ({
  createTripAction: vi.fn(),
  renameTripAction: vi.fn(),
}));

import { HomeClient } from './HomeClient';

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

function renderHome(trips: Trip[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <HomeClient trips={trips} tz="UTC" />
    </NextIntlClientProvider>,
  );
}

describe('HomeClient', () => {
  it('shows the empty state when there are no trips', () => {
    renderHome([]);
    expect(screen.getByText(en.home.emptyHeadline)).toBeInTheDocument();
    expect(screen.getByText(en.home.emptySubtext)).toBeInTheDocument();
  });

  it('lists trip cards when trips exist', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00Z'));
    renderHome([makeTrip()]);
    expect(screen.getByText('Tokyo adventure')).toBeInTheDocument();
    expect(screen.queryByText(en.home.emptyHeadline)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('opens the New Trip sheet from the FAB', async () => {
    renderHome([makeTrip()]);
    await userEvent.click(screen.getByRole('button', { name: en.home.newTrip }));
    expect(screen.getByRole('dialog', { name: en.newTripSheet.title })).toBeInTheDocument();
  });
});
