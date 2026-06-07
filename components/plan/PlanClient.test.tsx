import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO, LegDTO } from '@/src/lib/planView';

const replace = vi.fn();
let search = 'view=list&bucket=days&date=2026-05-03';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/trip/t1/plan',
  useSearchParams: () => new URLSearchParams(search),
}));

// Use vi.hoisted so these are available when the vi.mock factory is hoisted.
const {
  promoteToDayAction,
  reorderDayAction,
  recomputeDayLegsAction,
  moveToSavedAction,
  deletePlaceAction,
} = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promoteToDayAction: vi.fn(async (_id?: any, _date?: any) => ({ id: 'p' })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reorderDayAction: vi.fn(async (_tripId?: any, _day?: any, _ids?: any) => undefined),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recomputeDayLegsAction: vi.fn(async (_tripId?: any, _day?: any, _mode?: any) => []),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  moveToSavedAction: vi.fn(async (_id?: any) => ({ id: 'p1' })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deletePlaceAction: vi.fn(async (_id?: any) => undefined),
}));
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: vi.fn(async () => ({ id: 'p-new' })),
  updatePlaceAction: vi.fn(async () => ({ id: 'p1' })),
  deletePlaceAction,
  reorderDayAction,
  promoteToDayAction,
  moveToSavedAction,
  recomputeDayLegsAction,
}));

// Stub the Google-dependent sheet + the B3 map so PlanClient is testable
// without the Google loader / the real map internals.
vi.mock('@/components/plan/AddPlaceSheet', () => ({
  AddPlaceSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="add-place-sheet" /> : null),
}));
vi.mock('@/components/plan/PlanMap', () => ({
  PlanMap: (props: Record<string, unknown>) => (
    <div data-testid="plan-map" data-bucket={String(props.bucket)} data-online={String(props.online)} />
  ),
}));

import { PlanClient } from './PlanClient';

const trip = {
  id: 't1', name: 'Tokyo', startDate: '2026-05-03', endDate: '2026-05-05',
  coverPhoto: null,
};
const places: PlaceDTO[] = [
  { id: 'a', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g-a', name: 'Stop A', address: 'X', lat: 1, lng: 2, category: 'sightseeing', scheduledTime: '09:00', durationMin: null, cost: null, notes: null, orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null },
  { id: 'b', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g-b', name: 'Stop B', address: 'Y', lat: 3, lng: 4, category: 'other', scheduledTime: null, durationMin: null, cost: null, notes: null, orderIndex: 1, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null },
  { id: 's', tripId: 't1', dayDate: null, googlePlaceId: null, name: 'Saved One', address: 'Z', lat: 5, lng: 6, category: 'other', scheduledTime: null, durationMin: null, cost: null, notes: null, orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null },
];
const legs: LegDTO[] = [
  { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk', durationSeconds: 720, distanceMeters: 900, polyline: null },
];

/**
 * Route fetch by URL: /api/trips/t1 → {trip}; /places (light) and
 * /places?detail=full (hydrate) → {places,legs}; /restaurants → {restaurants}
 * (empty by default; the map overlay reads it).
 */
function mockFetch() {
  const f = vi.fn(async (url: string) => {
    if (url.includes('/places')) {
      return { ok: true, json: async () => JSON.parse(JSON.stringify({ places, legs })) };
    }
    if (url.endsWith('/restaurants')) {
      return { ok: true, json: async () => ({ restaurants: [] }) };
    }
    return { ok: true, json: async () => JSON.parse(JSON.stringify({ trip })) };
  });
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  return f;
}

function renderPlan() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlanClient tripId="t1" tz="UTC" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  search = 'view=list&bucket=days&date=2026-05-03';
  replace.mockClear();
  promoteToDayAction.mockClear();
  reorderDayAction.mockClear();
  recomputeDayLegsAction.mockClear();
  moveToSavedAction.mockClear();
  deletePlaceAction.mockClear();
  vi.stubGlobal('navigator', { onLine: true });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  vi.resetModules();
});

describe('PlanClient', () => {
  it('fetches both endpoints and renders the day itinerary', async () => {
    const f = mockFetch();
    renderPlan();
    expect(await screen.findByText('Stop A')).toBeInTheDocument();
    expect(screen.getByText('Stop B')).toBeInTheDocument();
    expect(f).toHaveBeenCalledWith('/api/trips/t1', { credentials: 'same-origin' });
    expect(f).toHaveBeenCalledWith('/api/trips/t1/places', { credentials: 'same-origin' });
  });

  it('background-hydrates the heavy fields (aiSummary + polylines) via ?detail=full', async () => {
    const f = mockFetch();
    renderPlan();
    await screen.findByText('Stop A');
    await waitFor(() =>
      expect(f).toHaveBeenCalledWith('/api/trips/t1/places?detail=full', {
        credentials: 'same-origin',
      }),
    );
  });

  it('fetches both base-path-prefixed endpoints when NEXT_PUBLIC_BASE_PATH is set', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_BASE_PATH = '/burgergo';
    const { PlanClient: Prefixed } = await import('./PlanClient');
    const f = mockFetch();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <Prefixed tripId="t1" tz="UTC" />
      </NextIntlClientProvider>,
    );
    await screen.findByText('Stop A');
    expect(f).toHaveBeenCalledWith('/burgergo/api/trips/t1', { credentials: 'same-origin' });
    expect(f).toHaveBeenCalledWith('/burgergo/api/trips/t1/places', { credentials: 'same-origin' });
  });

  it('switches to the Saved bucket via the toggle, writing URL state', async () => {
    mockFetch();
    renderPlan();
    await screen.findByText('Stop A');
    await userEvent.click(screen.getByRole('button', { name: en.plan.savedTab }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('bucket=saved'));
  });

  it('switching to Map view writes URL state and mounts the PlanMap seam (online)', async () => {
    mockFetch();
    renderPlan();
    await screen.findByText('Stop A');
    await userEvent.click(screen.getByRole('button', { name: en.plan.mapTab }));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('view=map'));
  });

  it('renders the PlanMap (with online=true) when view=map', async () => {
    search = 'view=map&bucket=days&date=2026-05-03';
    mockFetch();
    renderPlan();
    const map = await screen.findByTestId('plan-map');
    expect(map).toHaveAttribute('data-online', 'true');
    expect(map).toHaveAttribute('data-bucket', 'days');
  });

  it('shows the day strip in list view but hides it in map view (map has its own legend)', async () => {
    search = 'view=list&bucket=days&date=2026-05-03';
    mockFetch();
    const { unmount } = renderPlan();
    await screen.findByText('Stop A');
    expect(screen.getByRole('button', { name: /Day 1/ })).toBeInTheDocument();
    unmount();

    search = 'view=map&bucket=days&date=2026-05-03';
    mockFetch();
    renderPlan();
    await screen.findByTestId('plan-map');
    expect(screen.queryByRole('button', { name: /Day 1/ })).not.toBeInTheDocument();
  });

  it('renders PlanMap with online=false when offline + map view (PlanMap owns offline branch)', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    search = 'view=map&bucket=days&date=2026-05-03';
    mockFetch();
    renderPlan();
    const map = await screen.findByTestId('plan-map');
    expect(map).toHaveAttribute('data-online', 'false');
    expect(map).toHaveAttribute('data-bucket', 'days');
  });

  it('promotes a Saved place to a day and recomputes that day legs', async () => {
    search = 'view=list&bucket=saved&date=2026-05-03';
    mockFetch();
    renderPlan();
    await screen.findByText('Saved One');
    await userEvent.click(screen.getByRole('button', { name: en.plan.addToDay }));
    await userEvent.click(screen.getByRole('button', { name: /Day 2/ }));
    await waitFor(() => expect(promoteToDayAction).toHaveBeenCalledWith('s', '2026-05-04'));
    await waitFor(() =>
      expect(recomputeDayLegsAction).toHaveBeenCalledWith('t1', '2026-05-04', 'walk'),
    );
  });

  it('disables mutations when offline (List view)', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    mockFetch();
    renderPlan();
    await screen.findByText('Stop A');
    expect(screen.getByRole('button', { name: en.plan.addPlace })).toBeDisabled();
  });

  it('shows a mutation error banner when a Server Action rejects, then re-fetches', async () => {
    search = 'view=list&bucket=saved&date=2026-05-03';
    mockFetch();
    promoteToDayAction.mockRejectedValueOnce(new Error('server error'));
    renderPlan();
    await screen.findByText('Saved One');
    await userEvent.click(screen.getByRole('button', { name: en.plan.addToDay }));
    await userEvent.click(screen.getByRole('button', { name: /Day 2/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(en.plan.mutationFailed);
  });
});
