import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';
import { PlaceCard } from './PlaceCard';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g1',
    name: 'Senso-ji', address: 'Asakusa, Tokyo', lat: 35.71, lng: 139.79,
    category: 'sightseeing', scheduledTime: '09:30', durationMin: 90, cost: 1500,
    notes: null, orderIndex: 0, photoPath: null, photos: [], ...over,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof PlaceCard>> = {}) {
  const onTap = vi.fn();
  const onMoveToSaved = vi.fn();
  const onMoveToDay = vi.fn();
  const onDelete = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceCard
        place={place()}
        pinNumber={1}
        pinColor="#EE5B3C"
        currency="JPY"
        locale="en"
        disabled={false}
        onTap={onTap}
        onMoveToSaved={onMoveToSaved}
        onMoveToDay={onMoveToDay}
        onDelete={onDelete}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onTap, onMoveToSaved, onMoveToDay, onDelete };
}

describe('PlaceCard', () => {
  it('renders the pin number, name, address, and meta row', () => {
    renderCard();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Senso-ji')).toBeInTheDocument();
    expect(screen.getByText(/Asakusa, Tokyo/)).toBeInTheDocument();
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.getByText('90 min')).toBeInTheDocument();
    expect(screen.getByText('¥1,500')).toBeInTheDocument();
  });

  it('shows the cached Google card photo via the photos handler when photoPath is set', () => {
    renderCard({ place: place({ id: 'p9', photoPath: '/whatever/x.webp' }) });
    const img = screen.getByRole('img', { name: 'Senso-ji' });
    expect(img).toHaveAttribute('src', '/api/photos/p9/card');
  });

  it('invokes onTap when the card body is clicked', async () => {
    const { onTap } = renderCard();
    await userEvent.click(screen.getByText('Senso-ji'));
    expect(onTap).toHaveBeenCalledWith('p1');
  });

  it('fires the swipe actions', async () => {
    const { onMoveToSaved, onMoveToDay, onDelete } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: en.plan.moveToSaved }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.moveToDay }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.delete }));
    expect(onMoveToSaved).toHaveBeenCalledWith('p1');
    expect(onMoveToDay).toHaveBeenCalledWith('p1');
    expect(onDelete).toHaveBeenCalledWith('p1');
  });

  it('disables the swipe-action buttons when disabled (offline)', () => {
    renderCard({ disabled: true });
    expect(screen.getByRole('button', { name: en.plan.moveToSaved })).toBeDisabled();
    expect(screen.getByRole('button', { name: en.plan.delete })).toBeDisabled();
  });
});
