import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO, LegDTO } from '@/src/lib/planView';
import { indexLegs } from '@/src/lib/legView';
import { DayItinerary, reorderIds } from './DayItinerary';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'a', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null,
    name: 'A', address: null, lat: 0, lng: 0, category: 'other',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, photos: [], ...over,
  };
}

const walkLeg: LegDTO = {
  fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
  durationSeconds: 720, distanceMeters: 900, polyline: null,
};

describe('reorderIds', () => {
  it('moves an id from one index to another, preserving the rest', () => {
    expect(reorderIds(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(reorderIds(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(reorderIds(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });
});

function renderDay(props: Partial<React.ComponentProps<typeof DayItinerary>> = {}) {
  const onAddPlace = vi.fn();
  const onAddFromSaved = vi.fn();
  const onReorder = vi.fn();
  const onTapPlace = vi.fn();
  const onMoveToSaved = vi.fn();
  const onMoveToDay = vi.fn();
  const onDelete = vi.fn();
  const onModeChange = vi.fn();
  const onRecompute = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DayItinerary
        dayLabel="Day 1"
        stops={[place({ id: 'a', orderIndex: 0, name: 'A' }), place({ id: 'b', orderIndex: 1, name: 'B' })]}
        legs={indexLegs([walkLeg])}
        mode="walk"
        dayColor="#EE5B3C"
        currency="JPY"
        locale="en"
        disabled={false}
        onAddPlace={onAddPlace}
        onAddFromSaved={onAddFromSaved}
        onReorder={onReorder}
        onTapPlace={onTapPlace}
        onMoveToSaved={onMoveToSaved}
        onMoveToDay={onMoveToDay}
        onDelete={onDelete}
        onModeChange={onModeChange}
        onRecompute={onRecompute}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onAddPlace, onAddFromSaved, onReorder, onModeChange };
}

describe('DayItinerary', () => {
  it('renders ordered cards with the interleaved leg chip', () => {
    renderDay();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('🚶 12 min · 0.9 km')).toBeInTheDocument();
  });

  it('shows the day mode control and forwards a mode change', async () => {
    const { onModeChange } = renderDay();
    await userEvent.click(screen.getByRole('button', { name: en.plan.travelModeDrive }));
    expect(onModeChange).toHaveBeenCalledWith('drive');
  });

  it('forwards Add place / Add from Saved', async () => {
    const { onAddPlace, onAddFromSaved } = renderDay();
    await userEvent.click(screen.getByRole('button', { name: en.plan.addPlace }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.addFromSaved }));
    expect(onAddPlace).toHaveBeenCalled();
    expect(onAddFromSaved).toHaveBeenCalled();
  });

  it('shows the empty state for a day with no stops', () => {
    renderDay({ stops: [], dayLabel: 'Day 3' });
    expect(
      screen.getByText(en.plan.emptyDayHeadline.replace('{dayLabel}', 'Day 3')),
    ).toBeInTheDocument();
  });
});
