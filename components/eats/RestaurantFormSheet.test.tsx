import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addRestaurantAction = vi.fn(async (..._a: any[]) => ({ id: 'r-new' }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateRestaurantAction = vi.fn(async (..._a: any[]) => ({ id: 'r1' }));
vi.mock('@/app/_actions/restaurants', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addRestaurantAction: (...a: any[]) => addRestaurantAction(...a),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateRestaurantAction: (...a: any[]) => updateRestaurantAction(...a),
  deleteRestaurantAction: vi.fn(),
  scheduleRestaurantToDayAction: vi.fn(),
  unscheduleRestaurantAction: vi.fn(),
}));

// Stub the Places autocomplete so typing in the address field never loads the
// real Google JS in jsdom; the geocode helper is mocked to return fixed coords.
vi.mock('@/components/plan/useGooglePlaces', () => ({
  usePlacesAutocomplete: () => ({
    predictions: [], loading: false, search: vi.fn(), select: vi.fn(), clear: vi.fn(),
  }),
}));
const forwardGeocode = vi.fn(async (_addr: string) => ({ lat: 35.0, lng: 139.0, address: '1 Test St' }));
vi.mock('@/components/plan/googleClient', () => ({
  forwardGeocode: (addr: string) => forwardGeocode(addr),
}));

import { RestaurantFormSheet } from './RestaurantFormSheet';

function existing(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
    status: 'been', priceLevel: 2, notes: 'Tonkotsu', linkedPlaceId: null,
    address: null, lat: null, lng: null, googlePlaceId: null,
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: null, ...over,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof RestaurantFormSheet>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RestaurantFormSheet
        open
        tripId="t1"
        restaurant={null}
        disabled={false}
        onClose={onClose}
        onSaved={onSaved}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onSaved };
}

beforeEach(() => {
  addRestaurantAction.mockClear();
  updateRestaurantAction.mockClear();
  forwardGeocode.mockClear();
});

describe('RestaurantFormSheet', () => {
  it('add mode: creates a restaurant with trimmed name + selected status', async () => {
    const { onSaved, onClose } = renderSheet();
    await userEvent.type(screen.getByLabelText(en.eats.nameLabel), '  Kani Doraku  ');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(addRestaurantAction).toHaveBeenCalled());
    expect(addRestaurantAction).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', name: 'Kani Doraku', status: 'want-to-try' }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('add mode: blocks submit when name is empty (no action call)', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    expect(addRestaurantAction).not.toHaveBeenCalled();
  });

  it('add mode: forward-geocodes a typed address and stores the coords', async () => {
    renderSheet();
    await userEvent.type(screen.getByLabelText(en.eats.nameLabel), 'Ichiran');
    await userEvent.type(screen.getByLabelText(en.eats.addressLabel), '1 Test St');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(addRestaurantAction).toHaveBeenCalled());
    expect(forwardGeocode).toHaveBeenCalledWith('1 Test St');
    expect(addRestaurantAction).toHaveBeenCalledWith(
      expect.objectContaining({ address: '1 Test St', lat: 35.0, lng: 139.0 }),
    );
  });

  it('edit mode: pre-fills fields and calls updateRestaurantAction with the id', async () => {
    const { onSaved } = renderSheet({ restaurant: existing() });
    const name = screen.getByLabelText(en.eats.nameLabel) as HTMLInputElement;
    expect(name.value).toBe('Ichiran');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ichiran Honten');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(updateRestaurantAction).toHaveBeenCalled());
    expect(updateRestaurantAction).toHaveBeenCalledWith('r1', expect.objectContaining({ name: 'Ichiran Honten' }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('parses rating/price selects to numbers and empty → null', async () => {
    renderSheet();
    await userEvent.type(screen.getByLabelText(en.eats.nameLabel), 'A');
    await userEvent.selectOptions(screen.getByLabelText(en.eats.ratingLabel), '5');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(addRestaurantAction).toHaveBeenCalled());
    expect(addRestaurantAction).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 5, priceLevel: null }),
    );
  });

  it('disables inputs + Save when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByLabelText(en.eats.nameLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: en.eats.save })).toBeDisabled();
  });

  it('shows an error and keeps the sheet open when the action rejects', async () => {
    addRestaurantAction.mockRejectedValueOnce(new Error('boom'));
    const { onClose, onSaved } = renderSheet();
    await userEvent.type(screen.getByLabelText(en.eats.nameLabel), 'A');
    await userEvent.click(screen.getByRole('button', { name: en.eats.save }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.eats.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('closes when Escape is pressed on the dialog', async () => {
    const { onClose } = renderSheet();
    await userEvent.type(screen.getByRole('dialog'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
