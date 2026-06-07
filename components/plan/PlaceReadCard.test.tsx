import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import { PlaceReadCard } from './PlaceReadCard';
import type { PlaceDTO } from '@/src/lib/planView';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-06-04', googlePlaceId: null,
    name: 'Senso-ji', address: 'Asakusa', lat: 35, lng: 139, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: 'My note',
    orderIndex: 0, photoPath: null, photos: [], aiSummary: 'A historic temple.',
    links: [{ id: 'l1', url: 'https://guide.example', title: 'Guide', thumbnail: null }],
    ...over,
  };
}

function renderCard(p = place(), props = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceReadCard place={p} onClose={vi.fn()} onEdit={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('PlaceReadCard', () => {
  it('shows name, AI summary, notes, and a link', () => {
    renderCard();
    expect(screen.getByText('Senso-ji')).toBeInTheDocument();
    expect(screen.getByText('A historic temple.')).toBeInTheDocument();
    expect(screen.getByText('My note')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Guide/ })).toHaveAttribute('href', 'https://guide.example');
  });

  it('calls onEdit when Edit is tapped', async () => {
    const onEdit = vi.fn();
    renderCard(place(), { onEdit });
    await userEvent.click(screen.getByRole('button', { name: en.plan.edit }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('truncates a long summary behind show more', async () => {
    const long = 'x '.repeat(400);
    renderCard(place({ aiSummary: long }));
    const toggle = screen.getByRole('button', { name: en.plan.showMore });
    expect(toggle).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: en.plan.showLess })).toBeInTheDocument();
  });

  it('shows an "Add to day" button only when onAddToDay is provided, and calls it', async () => {
    const onAddToDay = vi.fn();
    const { unmount } = renderCard(place(), { onAddToDay });
    await userEvent.click(screen.getByRole('button', { name: en.plan.addToDay }));
    expect(onAddToDay).toHaveBeenCalled();
    unmount();
    renderCard(); // no onAddToDay → no button
    expect(screen.queryByRole('button', { name: en.plan.addToDay })).not.toBeInTheDocument();
  });
});
