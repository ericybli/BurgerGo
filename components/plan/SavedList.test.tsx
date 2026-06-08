import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO, SavedListItem } from '@/src/lib/planView';
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
    orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null, listId: null, ...over,
  };
}

function renderSaved(props: Partial<React.ComponentProps<typeof SavedList>> = {}) {
  const handlers = {
    onPromote: vi.fn(),
    onTapPlace: vi.fn(),
    onAddPlace: vi.fn(),
    onMoveToList: vi.fn(),
    onDelete: vi.fn(),
    onCreateList: vi.fn(async (name: string): Promise<SavedListItem> => ({ id: 'new', name })),
    onRenameList: vi.fn(),
    onDeleteList: vi.fn(),
  };
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SavedList saved={[place()]} lists={[]} days={days} disabled={false} {...handlers} {...props} />
    </NextIntlClientProvider>,
  );
  return handlers;
}

describe('SavedList', () => {
  it('renders loose saved cards with name and address', () => {
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

  it('shows the empty state only when there are no places AND no lists', () => {
    renderSaved({ saved: [], lists: [] });
    expect(screen.getByText(en.plan.emptySavedHeadline)).toBeInTheDocument();
  });

  it('groups places under a collapsible list, revealed on expand', async () => {
    renderSaved({
      saved: [place(), place({ id: 's2', name: 'Sunset Beach', listId: 'L1' })],
      lists: [{ id: 'L1', name: 'Beaches' }],
    });
    // Loose card visible; the list's member is hidden while collapsed.
    expect(screen.getByText('Backup Cafe')).toBeInTheDocument();
    expect(screen.queryByText('Sunset Beach')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Beaches/ }));
    expect(screen.getByText('Sunset Beach')).toBeInTheDocument();
  });

  it('moves a place into a list via Manage → Move to list → pick', async () => {
    const { onMoveToList } = renderSaved({ lists: [{ id: 'L1', name: 'Beaches' }] });
    await userEvent.click(screen.getByRole('button', { name: en.plan.manage }));
    await userEvent.click(screen.getByRole('button', { name: en.savedLists.moveToList }));
    const dialog = screen.getByRole('dialog', { name: en.savedLists.moveToListTitle });
    await userEvent.click(within(dialog).getByRole('button', { name: /Beaches/ }));
    expect(onMoveToList).toHaveBeenCalledWith('s1', 'L1');
  });

  it('deletes a saved place via Manage → Delete', async () => {
    const { onDelete } = renderSaved();
    await userEvent.click(screen.getByRole('button', { name: en.plan.manage }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.delete }));
    expect(onDelete).toHaveBeenCalledWith('s1');
  });

  it('creates a list from the top button', async () => {
    const { onCreateList } = renderSaved();
    await userEvent.click(screen.getByRole('button', { name: en.savedLists.newListOption }));
    const dialog = screen.getByRole('dialog', { name: en.savedLists.createTitle });
    await userEvent.type(within(dialog).getByLabelText(en.savedLists.namePlaceholder), 'Coffee');
    await userEvent.click(within(dialog).getByRole('button', { name: en.savedLists.create }));
    expect(onCreateList).toHaveBeenCalledWith('Coffee');
  });

  it('deletes a list (two-tap confirm) without deleting its places', async () => {
    const { onDeleteList } = renderSaved({ lists: [{ id: 'L1', name: 'Beaches' }] });
    await userEvent.click(screen.getByRole('button', { name: en.savedLists.listActions }));
    await userEvent.click(screen.getByRole('button', { name: en.savedLists.deleteList }));
    expect(onDeleteList).not.toHaveBeenCalled(); // first tap = confirm
    await userEvent.click(screen.getByRole('button', { name: en.savedLists.deleteListConfirm }));
    expect(onDeleteList).toHaveBeenCalledWith('L1');
  });
});
