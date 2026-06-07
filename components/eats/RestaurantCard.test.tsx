import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import { RestaurantCard } from './RestaurantCard';

function r(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
    status: 'been', priceLevel: 2, notes: 'Tonkotsu', linkedPlaceId: 'p1',
    address: null, lat: null, lng: null, googlePlaceId: null,
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: '2026-06-06', ...over,
  };
}

function renderCard(over: Partial<RestaurantDTO> = {}) {
  const onTap = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RestaurantCard restaurant={r(over)} onTap={onTap} />
    </NextIntlClientProvider>,
  );
  return { onTap };
}

describe('RestaurantCard', () => {
  it('renders name, cuisine chip, status pill, price, notes', () => {
    renderCard();
    expect(screen.getByText('Ichiran')).toBeInTheDocument();
    expect(screen.getByText('Ramen')).toBeInTheDocument();
    expect(screen.getByText(en.eats.statusBeen)).toBeInTheDocument();
    expect(screen.getByText('$$')).toBeInTheDocument();
    expect(screen.getByText('Tonkotsu')).toBeInTheDocument();
  });

  it('renders rating stars only when a rating is set', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <RestaurantCard restaurant={r({ rating: 3 })} onTap={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByLabelText('3 out of 5')).toBeInTheDocument();
    unmount();
    renderCard({ rating: null });
    expect(screen.queryByLabelText(/out of 5/)).not.toBeInTheDocument();
  });

  it('shows a scheduled indicator when scheduledDayDate is set', () => {
    renderCard({ scheduledDayDate: '2026-06-06' });
    expect(screen.getByText(/Scheduled/)).toBeInTheDocument();
  });

  it('omits the scheduled indicator when not scheduled', () => {
    renderCard({ scheduledDayDate: null });
    expect(screen.queryByText(/Scheduled/)).not.toBeInTheDocument();
  });

  it('calls onTap with the restaurant id when the card is clicked', async () => {
    const { onTap } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: /Ichiran/ }));
    expect(onTap).toHaveBeenCalledWith('r1');
  });
});
