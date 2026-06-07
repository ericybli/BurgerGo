import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { PlaceInfoCard } from './PlaceInfoCard';
import type { PlaceMarker } from '@/src/lib/map/markers';

const DAY_MARKER: PlaceMarker = {
  id: 'p1',
  name: 'Senso-ji Temple',
  category: 'sightseeing',
  googlePlaceId: 'ChIJ8T1GpMGOGGARDYGSgpooDWw',
  photoPath: '/api/photos/ChIJ8T1GpMGOGGARDYGSgpooDWw/card',
  position: { lat: 35.7148, lng: 139.7967 },
  label: '1',
  color: '#EE5B3C',
  glyph: '🏛️',
};

function renderCard(
  marker: PlaceMarker = DAY_MARKER,
  bucket: 'days' | 'saved' = 'days',
  props: Partial<React.ComponentProps<typeof PlaceInfoCard>> = {},
) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceInfoCard
        marker={marker}
        bucket={bucket}
        onClose={vi.fn()}
        onSelectPlace={vi.fn()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe('PlaceInfoCard', () => {
  it('shows the name, localized category, and SW-cached thumbnail', () => {
    renderCard();
    expect(screen.getByText('Senso-ji Temple')).toBeInTheDocument();
    expect(screen.getByText(en.category.sightseeing)).toBeInTheDocument();
    const img = screen.getByRole('img', { name: 'Senso-ji Temple' });
    expect(img).toHaveAttribute('src', '/api/photos/ChIJ8T1GpMGOGGARDYGSgpooDWw/card');
  });

  it('builds an Open-in-Google-Maps link via placeUrl (place_id form)', () => {
    renderCard();
    const link = screen.getByRole('link', { name: en.planMap.openInMaps });
    const u = new URL(link.getAttribute('href')!);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/search/');
    expect(u.searchParams.get('query_place_id')).toBe('ChIJ8T1GpMGOGGARDYGSgpooDWw');
  });

  it('falls back to a coordinate query when there is no googlePlaceId', () => {
    renderCard({ ...DAY_MARKER, googlePlaceId: null });
    const link = screen.getByRole('link', { name: en.planMap.openInMaps });
    expect(new URL(link.getAttribute('href')!).searchParams.get('query')).toBe(
      '35.7148,139.7967',
    );
  });

  it('omits the thumbnail when photoPath is null', () => {
    renderCard({ ...DAY_MARKER, photoPath: null });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows "Add to day" only in the Saved bucket and calls onSelectPlace', async () => {
    const onSelectPlace = vi.fn();
    const user = userEvent.setup();
    renderCard(DAY_MARKER, 'saved', { onSelectPlace });
    const btn = screen.getByRole('button', { name: en.planMap.addToDay });
    await user.click(btn);
    expect(onSelectPlace).toHaveBeenCalledWith('p1');
  });

  it('does not show "Add to day" in the days bucket', () => {
    renderCard();
    expect(
      screen.queryByRole('button', { name: en.planMap.addToDay }),
    ).not.toBeInTheDocument();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderCard(DAY_MARKER, 'days', { onClose });
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
