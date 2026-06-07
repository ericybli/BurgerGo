import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';
import type { DerivedDay } from '@/src/lib/days';
import { SavedList } from './SavedList';

const days: DerivedDay[] = [
  { date: '2026-05-03', dayNumber: 1, weekday: 'Sunday', isToday: false },
  { date: '2026-05-04', dayNumber: 2, weekday: 'Monday', isToday: true },
];

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 's1', tripId: 't1', dayDate: null, googlePlaceId: 'g1',
    name: 'Backup Cafe', address: 'Shibuya', lat: 0, lng: 0, category: 'other',
    scheduledTime: null, durationMin: null, cost: null, notes: 'maybe',
    orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null, ...over,
  };
}

function renderSaved(props: Partial<React.ComponentProps<typeof SavedList>> = {}) {
  const onPromote = vi.fn();
  const onTapPlace = vi.fn();
  const onAddPlace = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SavedList
        saved={[place()]}
        days={days}
        disabled={false}
        onPromote={onPromote}
        onTapPlace={onTapPlace}
        onAddPlace={onAddPlace}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onPromote, onTapPlace, onAddPlace };
}

describe('SavedList', () => {
  it('renders saved cards with name and address', () => {
    renderSaved();
    expect(screen.getByText('Backup Cafe')).toBeInTheDocument();
    expect(screen.getByText(/Shibuya/)).toBeInTheDocument();
  });

  it('opens a day picker and promotes to the chosen day', async () => {
    const { onPromote } = renderSaved();
    await userEvent.click(screen.getByRole('button', { name: en.plan.addToDay }));
    expect(screen.getByText(en.plan.dayPickerTitle)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Day 2/ }));
    expect(onPromote).toHaveBeenCalledWith('s1', '2026-05-04');
  });

  it('disables the add-to-day button offline', () => {
    renderSaved({ disabled: true });
    expect(screen.getByRole('button', { name: en.plan.addToDay })).toBeDisabled();
  });

  it('shows an Add place button when populated and calls onAddPlace', async () => {
    const { onAddPlace } = renderSaved();
    await userEvent.click(screen.getByRole('button', { name: en.plan.addPlace }));
    expect(onAddPlace).toHaveBeenCalled();
  });

  it('disables the Add place button offline', () => {
    renderSaved({ disabled: true });
    expect(screen.getByRole('button', { name: en.plan.addPlace })).toBeDisabled();
  });

  it('shows the empty state when there are no saved places', () => {
    renderSaved({ saved: [] });
    expect(screen.getByText(en.plan.emptySavedHeadline)).toBeInTheDocument();
  });

  it('closes the day-picker dialog when Escape is pressed', async () => {
    renderSaved();
    // Open the day picker
    await userEvent.click(screen.getByRole('button', { name: en.plan.addToDay }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Press Escape on the dialog
    const dialog = screen.getByRole('dialog');
    await userEvent.type(dialog, '{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
