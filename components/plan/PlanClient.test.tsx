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

const promoteToDayAction = vi.fn(async () => ({ id: 'p' }));
const reorderDayAction = vi.fn(async () => undefined);
const recomputeDayLegsAction = vi.fn(async () => []);
const moveToSavedAction = vi.fn(async () => ({ id: 'p1' }));
const deletePlaceAction = vi.fn(async () => undefined);
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: vi.fn(async () => ({ id: 'p-new' })),
  updatePlaceAction: vi.fn(async () => ({ id: 'p1' })),
  deletePlaceAction: (...a: unknown[]) => deletePlaceAction(...a),
  reorderDayAction: (...a: unknown[]) => reorderDayAction(...a),
  promoteToDayAction: (...a: unknown[]) => promoteToDayAction(...a),
  moveToSavedAction: (...a: unknown[]) => moveToSavedAction(...a),
  recomputeDayLegsAction: (...a: unknown[]) => recomputeDayLegsAction(...a),
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
  { id: 'a', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g-a', name: 'Stop A', address: 'X', lat: 1, lng: 2, category: 'sightseeing', scheduledTime: '09:00', durationMin: null, cost: null, notes: null, orderIndex: 0, photoPath: null },
  { id: 'b', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g-b', name: 'Stop B', address: 'Y', lat: 3, lng: 4, category: 'other', scheduledTime: null, durationMin: null, cost: null, notes: null, orderIndex: 1, photoPath: null },
  { id: 's', tripId: 't1', dayDate: null, googlePlaceId: null, name: 'Saved One', address: 'Z', lat: 5, lng: 6, category: 'other', scheduledTime: null, durationMin: null, cost: null, notes: null, orderIndex: 0, photoPath: null },
];
const legs: LegDTO[] = [
  { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk', durationSeconds: 720, distanceMeters: 900, polyline: null },
];

/** Route fetch by URL: /api/trips/t1 → {trip}; /places → {places,legs}. */
function mockFetch() {
  const f = vi.fn(async (url: string) => {
    if (url.endsWith('/places')) {
      return { ok: true, json: async () => JSON.parse(JSON.stringify({ places, legs })) };
    }
    return { ok: true, json: async () => JSON.parse(JSON.stringify({ trip })) };
  });
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  return f;
}

function renderPlan() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlanClient tripId="t1" tz="UTC" currency="JPY" locale="en" />
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
afterEach(() => vi.unstubAllGlobals());

describe('PlanClient', () => {
  it('fetches both endpoints and renders the day itinerary', async () => {
    const f = mockFetch();
    renderPlan();
    expect(await screen.findByText('Stop A')).toBeInTheDocument();
    expect(screen.getByText('Stop B')).toBeInTheDocument();
    expect(f).toHaveBeenCalledWith('/api/trips/t1', { credentials: 'same-origin' });
    expect(f).toHaveBeenCalledWith('/api/trips/t1/places', { credentials: 'same-origin' });
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

  it('shows the map offline placeholder when offline + map view', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    search = 'view=map&bucket=days&date=2026-05-03';
    mockFetch();
    renderPlan();
    expect(await screen.findByText(en.plan.mapNeedsConnectionHeadline)).toBeInTheDocument();
    expect(screen.queryByTestId('plan-map')).not.toBeInTheDocument();
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
});
