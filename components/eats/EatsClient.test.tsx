import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/app/_actions/restaurants', () => ({
  addRestaurantAction: vi.fn(async () => ({ id: 'r-new' })),
  updateRestaurantAction: vi.fn(async () => ({ id: 'r1' })),
  deleteRestaurantAction: vi.fn(async () => undefined),
  scheduleRestaurantToDayAction: vi.fn(async () => ({ restaurant: { id: 'r1' }, place: { id: 'p1' } })),
  unscheduleRestaurantAction: vi.fn(async () => ({ id: 'r1' })),
}));

import { EatsClient } from './EatsClient';

const TRIP = { id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07', coverPhoto: null };
const RESTAURANTS = [
  {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4, status: 'been',
    priceLevel: 2, notes: null, linkedPlaceId: null, createdAt: 0, updatedAt: 0, scheduledDayDate: null,
  },
  {
    id: 'r2', tripId: 't1', name: 'Kani', cuisine: null, rating: null, status: 'want-to-try',
    priceLevel: null, notes: null, linkedPlaceId: null, createdAt: 0, updatedAt: 0, scheduledDayDate: null,
  },
];

function mockFetch(restaurants = RESTAURANTS) {
  return vi.fn(async (url: string) => {
    if ((url as string).endsWith('/restaurants')) {
      return { ok: true, json: async () => ({ restaurants }) } as Response;
    }
    return { ok: true, json: async () => ({ trip: TRIP }) } as Response;
  });
}

function renderClient() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EatsClient tripId="t1" tz="Asia/Tokyo" currency="JPY" locale="en" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

describe('EatsClient', () => {
  it('fetches and renders restaurant cards', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    expect(await screen.findByText('Ichiran')).toBeInTheDocument();
    expect(screen.getByText('Kani')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    await screen.findByText('Ichiran');
    await userEvent.click(screen.getByRole('button', { name: en.eats.filterBeen }));
    expect(screen.getByText('Ichiran')).toBeInTheDocument();
    expect(screen.queryByText('Kani')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no restaurants', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    renderClient();
    expect(await screen.findByText(en.eats.empty.headline)).toBeInTheDocument();
  });

  it('opens the add sheet from the Add button', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    await screen.findByText('Ichiran');
    await userEvent.click(screen.getByRole('button', { name: en.eats.addRestaurant }));
    expect(screen.getByRole('dialog', { name: en.eats.addRestaurant })).toBeInTheDocument();
  });

  it('opens the detail sheet when a card is tapped', async () => {
    vi.stubGlobal('fetch', mockFetch());
    renderClient();
    await userEvent.click(await screen.findByRole('button', { name: /Ichiran/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Ichiran' });
    expect(within(dialog).getByRole('button', { name: en.eats.scheduleToDay })).toBeInTheDocument();
  });

  it('shows the error state when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) } as Response)));
    renderClient();
    expect(await screen.findByText(en.eats.errorHeadline)).toBeInTheDocument();
  });
});
