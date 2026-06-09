import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';
import { deriveDays } from '@/src/lib/days';
import { TripOverview } from './TripOverview';

// A far-future trip → status is deterministically 'upcoming' (relevant day = Day 1),
// regardless of when the suite runs, so no clock mocking is needed.
const trip = { startDate: '2099-09-04', endDate: '2099-09-12' };

function place(over: Partial<PlaceDTO>): PlaceDTO {
  return {
    id: 'x', tripId: 't1', dayDate: '2099-09-04', googlePlaceId: null, name: 'X',
    address: null, lat: 19, lng: -155, category: 'sightseeing', scheduledTime: null,
    durationMin: null, cost: null, notes: null, orderIndex: 0, photoPath: null,
    photos: [], aiSummary: null, links: [], legMode: null, listId: null, ...over,
  };
}

const places: PlaceDTO[] = [
  place({ id: 's1', name: 'Beach', scheduledTime: '08:00', orderIndex: 0 }),
  place({ id: 'h1', name: 'Volcano Inn', category: 'airbnb', orderIndex: 1 }),
  place({ id: 's2', name: 'Sea Arch', scheduledTime: '14:00', orderIndex: 2 }),
];

function renderOverview() {
  const onView = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      <TripOverview
        tripId="t1"
        trip={trip}
        tz="UTC"
        days={deriveDays(trip, 'UTC')}
        places={places}
        nowHHMM="10:00"
        onViewPlace={onView}
      />
    </NextIntlClientProvider>,
  );
  return { onView };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        weather: { date: '2099-09-04', tMaxC: 28, tMinC: 22, code: 61, precipProb: 40, source: 'forecast' },
      }),
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('TripOverview', () => {
  it('is collapsed by default — shows the Overview label + day summary, hides the plan list', () => {
    renderOverview();
    expect(screen.getByText(en.plan.overview)).toBeInTheDocument();
    expect(screen.getByText(/Day 1 ·/)).toBeInTheDocument();
    // Collapsed → the expanded plan list (e.g. Sea Arch) isn't rendered.
    expect(screen.queryByText('Sea Arch')).not.toBeInTheDocument();
  });

  it('expands to show next stop, hotel, the day plan, and weather', async () => {
    const { onView } = renderOverview();
    await userEvent.click(screen.getByRole('button', { name: /Overview/ }));

    // The lodging shows in both the hotel row and the plan list.
    expect(screen.getAllByText('Volcano Inn').length).toBeGreaterThan(0);
    // Sea Arch is only in the plan list (not next/hotel) → unique.
    expect(screen.getByText('Sea Arch')).toBeInTheDocument();
    // Weather row hydrates from the fetch.
    await waitFor(() => expect(screen.getByText(/28°\/22°/)).toBeInTheDocument());
    expect(screen.getByText(/40% rain/)).toBeInTheDocument();

    // Tapping a plan row opens the place read view.
    await userEvent.click(screen.getByText('Sea Arch'));
    expect(onView).toHaveBeenCalledWith('s2');
  });

  it('persists the expanded state to localStorage', async () => {
    renderOverview();
    await userEvent.click(screen.getByRole('button', { name: /Overview/ }));
    expect(localStorage.getItem('burgergo.overview.collapsed')).toBe('0');
  });
});
