import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const replaceMock = vi.fn();
let pathnameValue = '/trip/trip-1/plan';
let searchValue = '';
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameValue,
  useSearchParams: () => new URLSearchParams(searchValue),
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));
vi.mock('@/app/_actions/trips', () => ({
  createTripAction: vi.fn(),
  renameTripAction: vi.fn(),
}));

import { TripShellClient } from './TripShellClient';

const TRIP = {
  id: 'trip-1',
  name: 'Osaka',
  startDate: '2026-06-05',
  endDate: '2026-06-07',
  coverPhoto: null,
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch,
  );
}

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TripShellClient tripId="trip-1">
        <div>Plan content</div>
      </TripShellClient>
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('TripShellClient', () => {
  it('renders a loading skeleton before the trip resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})) as unknown as typeof fetch);
    renderShell();
    expect(screen.getByText(en.trip.loading)).toBeInTheDocument();
    // children render immediately under the skeleton header.
    expect(screen.getByText('Plan content')).toBeInTheDocument();
  });

  it('renders the header (name + date subtitle), children, and tab bar once loaded', async () => {
    mockFetch({ trip: TRIP, days: [] });
    renderShell();
    expect(await screen.findByText('Osaka')).toBeInTheDocument();
    // "Jun 5 – Jun 7" subtitle from the date range.
    expect(screen.getByText(/Jun 5/)).toBeInTheDocument();
    expect(screen.getByText('Plan content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Trip sections' })).toBeInTheDocument();
    // Fetched the per-trip read endpoint.
    expect(fetch).toHaveBeenCalledWith('/api/trips/trip-1', { credentials: 'same-origin' });
  });

  it('renders a "trip not found" state when the trip 404s', async () => {
    mockFetch({ error: 'not_found' }, false, 404);
    renderShell();
    expect(await screen.findByText(en.trip.notFoundHeadline)).toBeInTheDocument();
    expect(screen.getByText(en.trip.notFoundSubtext)).toBeInTheDocument();
    // No tab bar / children for a missing trip.
    expect(screen.queryByText('Plan content')).not.toBeInTheDocument();
  });

  it('renders the not-found UI and does not crash when fetch throws (offline, no cache)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => { throw new Error('Failed to fetch'); }) as unknown as typeof fetch,
    );
    renderShell();
    expect(await screen.findByText(en.trip.notFoundHeadline)).toBeInTheDocument();
    expect(screen.getByText(en.trip.notFoundSubtext)).toBeInTheDocument();
    // Header/children are not rendered when there is no trip data.
    expect(screen.queryByText('Osaka')).not.toBeInTheDocument();
    expect(screen.queryByText('Plan content')).not.toBeInTheDocument();
  });
});

describe('TripShellClient — active-trip auto-land (§3.8)', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pathnameValue = '/trip/trip-1/plan';
    searchValue = '';
    // Use fake timers with shouldAdvanceTime so async/await + findByText still work,
    // while Date.now() / new Date() are frozen for deterministic landingDate tests.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-06T10:00:00Z')); // within Osaka 06-05..06-07
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("replaces the URL with today's date on an active trip when no date param", async () => {
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await vi.waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        '/trip/trip-1/plan?view=list&bucket=days&date=2026-06-06',
      ),
    );
  });

  it('does not redirect when a date param is already present', async () => {
    searchValue = 'view=list&bucket=days&date=2026-06-05';
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await Promise.resolve();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('lands on start_date for a non-active (past) trip', async () => {
    vi.setSystemTime(new Date('2026-07-01T10:00:00Z')); // after Osaka end
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await vi.waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        '/trip/trip-1/plan?view=list&bucket=days&date=2026-06-05',
      ),
    );
  });

  it('does not redirect on a non-plan path (e.g. eats)', async () => {
    pathnameValue = '/trip/trip-1/eats';
    mockFetch({ trip: TRIP });
    renderShell();
    await screen.findByText('Osaka');
    await Promise.resolve();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
