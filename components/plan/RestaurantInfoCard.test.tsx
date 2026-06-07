import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { RestaurantInfoCard } from './RestaurantInfoCard';
import type { RestaurantMarkerInput } from '@/src/lib/map/markers';

function rest(over: Partial<RestaurantMarkerInput> = {}): RestaurantMarkerInput {
  return {
    id: 'r1', name: 'Ichiran', lat: 35.0, lng: 139.0, googlePlaceId: 'gx',
    cuisine: 'Ramen', address: '1-2-3 Shibuya', notes: 'Tonkotsu', ...over,
  };
}

function renderCard(restaurant = rest(), onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RestaurantInfoCard restaurant={restaurant} onClose={onClose} />
    </NextIntlClientProvider>,
  );
}

describe('RestaurantInfoCard', () => {
  it('shows name, cuisine, address, notes, and an Open-in-Maps link', () => {
    renderCard();
    expect(screen.getByText('Ichiran')).toBeInTheDocument();
    expect(screen.getByText('Ramen')).toBeInTheDocument();
    expect(screen.getByText('1-2-3 Shibuya')).toBeInTheDocument();
    expect(screen.getByText('Tonkotsu')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: en.planMap.openInMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
  });

  it('omits optional fields when absent', () => {
    renderCard(rest({ cuisine: null, address: null, notes: null }));
    expect(screen.getByText('Ichiran')).toBeInTheDocument();
    expect(screen.queryByText('Ramen')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is tapped', async () => {
    const onClose = vi.fn();
    renderCard(rest(), onClose);
    await userEvent.click(screen.getByRole('button', { name: en.planMap.closeInfoCard }));
    expect(onClose).toHaveBeenCalled();
  });
});
