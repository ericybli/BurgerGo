import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { Trip } from '@/src/db/schema';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const createTripAction = vi.fn();
vi.mock('@/app/_actions/trips', () => ({
  createTripAction: (...args: unknown[]) => createTripAction(...args),
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

/** Mock global.fetch to resolve `/api/trips` with the given trips JSON. */
function mockFetchTrips(trips: Trip[]) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => JSON.parse(JSON.stringify(trips)),
  })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderHome() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <HomeClient tz="UTC" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  createTripAction.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HomeClient', () => {
  it('shows a loading state before trips resolve', () => {
    // fetch never resolves → stays in loading
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);
    renderHome();
    expect(screen.getByText(en.home.loading)).toBeInTheDocument();
  });

  it('fetches /api/trips on mount and shows the empty state when none exist', async () => {
    const fetchMock = mockFetchTrips([]);
    renderHome();
    expect(await screen.findByText(en.home.emptyHeadline)).toBeInTheDocument();
    expect(screen.getByText(en.home.emptySubtext)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/trips', { credentials: 'same-origin' });
  });

  it('lists trip cards when the fetch returns trips', async () => {
    // A far-past trip → status is deterministic regardless of the real clock.
    mockFetchTrips([makeTrip({ startDate: '2020-01-01', endDate: '2020-01-07' })]);
    renderHome();
    expect(await screen.findByText('Tokyo adventure')).toBeInTheDocument();
    expect(screen.queryByText(en.home.emptyHeadline)).not.toBeInTheDocument();
  });

  it('shows a friendly error when the fetch fails with no cached data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch);
    renderHome();
    expect(await screen.findByText(en.home.errorHeadline)).toBeInTheDocument();
    expect(screen.getByText(en.home.errorSubtext)).toBeInTheDocument();
  });

  it('opens the New Trip sheet from the FAB', async () => {
    const user = userEvent.setup();
    mockFetchTrips([makeTrip()]);
    renderHome();
    await screen.findByText('Tokyo adventure');
    await user.click(screen.getByRole('button', { name: en.home.newTrip }));
    expect(screen.getByRole('dialog', { name: en.newTripSheet.title })).toBeInTheDocument();
  });

  it('shows a retry button on error and re-invokes fetch when clicked', async () => {
    const user = userEvent.setup();
    // First call throws; second call succeeds with an empty list.
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    renderHome();
    expect(await screen.findByText(en.home.errorHeadline)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.common.retry })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: en.common.retry }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('re-fetches /api/trips after a successful trip creation', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchTrips([]);
    createTripAction.mockResolvedValue(makeTrip());
    renderHome();
    await screen.findByText(en.home.emptyHeadline);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Open the sheet and submit a valid trip. Both the empty-state CTA and the
    // FAB share the "New trip" label; the FAB is the last such button.
    const newTripButtons = screen.getAllByRole('button', { name: en.home.newTrip });
    await user.click(newTripButtons[newTripButtons.length - 1]!);
    await user.type(screen.getByLabelText(en.newTripSheet.nameLabel), 'Osaka');
    await user.click(screen.getByRole('button', { name: en.newTripSheet.create }));

    await waitFor(() => expect(createTripAction).toHaveBeenCalled());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
