import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';
import type { DerivedDay } from '@/src/lib/days';

const updateRestaurantAction = vi.fn(async () => ({ id: 'r1' }));
const deleteRestaurantAction = vi.fn(async () => undefined);
const scheduleRestaurantToDayAction = vi.fn(async () => ({ restaurant: { id: 'r1' }, place: { id: 'p1' } }));
const unscheduleRestaurantAction = vi.fn(async () => ({ id: 'r1' }));
vi.mock('@/app/_actions/restaurants', () => ({
  addRestaurantAction: vi.fn(),
  updateRestaurantAction: (...a: unknown[]) => updateRestaurantAction(...a),
  deleteRestaurantAction: (...a: unknown[]) => deleteRestaurantAction(...a),
  scheduleRestaurantToDayAction: (...a: unknown[]) => scheduleRestaurantToDayAction(...a),
  unscheduleRestaurantAction: (...a: unknown[]) => unscheduleRestaurantAction(...a),
}));

import { RestaurantDetailSheet } from './RestaurantDetailSheet';

const DAYS: DerivedDay[] = [
  { date: '2026-06-05', dayNumber: 1, weekday: 'Friday', isToday: false },
  { date: '2026-06-06', dayNumber: 2, weekday: 'Saturday', isToday: true },
];

function r(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
    status: 'want-to-try', priceLevel: 2, notes: null, linkedPlaceId: null,
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: null, ...over,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof RestaurantDetailSheet>> = {}) {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  const onEdit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RestaurantDetailSheet
        open restaurant={r()} days={DAYS} disabled={false}
        onClose={onClose} onChanged={onChanged} onEdit={onEdit} {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onChanged, onEdit };
}

beforeEach(() => {
  updateRestaurantAction.mockClear();
  deleteRestaurantAction.mockClear();
  scheduleRestaurantToDayAction.mockClear();
  unscheduleRestaurantAction.mockClear();
});

describe('RestaurantDetailSheet', () => {
  it('toggles status to "been" via updateRestaurantAction', async () => {
    const { onChanged } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.markBeen }));
    await waitFor(() => expect(updateRestaurantAction).toHaveBeenCalledWith('r1', { status: 'been' }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows "mark want to try" when the restaurant is already been', async () => {
    renderSheet({ restaurant: r({ status: 'been' }) });
    await userEvent.click(screen.getByRole('button', { name: en.eats.markWantToTry }));
    await waitFor(() => expect(updateRestaurantAction).toHaveBeenCalledWith('r1', { status: 'want-to-try' }));
  });

  it('schedules to a chosen day', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.scheduleToDay }));
    await userEvent.click(screen.getByRole('button', { name: /Day 2/ }));
    await waitFor(() => expect(scheduleRestaurantToDayAction).toHaveBeenCalledWith('r1', '2026-06-06'));
  });

  it('shows "remove from plan" only when scheduled and calls unschedule', async () => {
    const { rerender } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <RestaurantDetailSheet open restaurant={r({ scheduledDayDate: null })} days={DAYS}
          disabled={false} onClose={vi.fn()} onChanged={vi.fn()} onEdit={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button', { name: en.eats.unschedule })).not.toBeInTheDocument();
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <RestaurantDetailSheet open restaurant={r({ scheduledDayDate: '2026-06-06', linkedPlaceId: 'p1' })}
          days={DAYS} disabled={false} onClose={vi.fn()} onChanged={vi.fn()} onEdit={vi.fn()} />
      </NextIntlClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: en.eats.unschedule }));
    await waitFor(() => expect(unscheduleRestaurantAction).toHaveBeenCalledWith('r1'));
  });

  it('requires a confirm tap before deleting', async () => {
    const { onChanged } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.delete }));
    expect(deleteRestaurantAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: en.eats.confirmDelete }));
    await waitFor(() => expect(deleteRestaurantAction).toHaveBeenCalledWith('r1'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('delegates Edit to onEdit', async () => {
    const { onEdit } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.editRestaurant }));
    expect(onEdit).toHaveBeenCalledWith('r1');
  });

  it('disables mutating buttons when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByRole('button', { name: en.eats.markBeen })).toBeDisabled();
  });

  it('closes when Escape is pressed', async () => {
    const { onClose } = renderSheet();
    await userEvent.type(screen.getByRole('dialog'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
