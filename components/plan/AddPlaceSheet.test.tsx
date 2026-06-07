import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addPlaceAction = vi.fn(async (..._a: any[]) => ({ id: 'new-place' }));
const generatePlaceSummaryAction = vi.fn(async (_id: string) => null);
vi.mock('@/app/_actions/places', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addPlaceAction: (...a: any[]) => addPlaceAction(...a),
  generatePlaceSummaryAction: (id: string) => generatePlaceSummaryAction(id),
  updatePlaceAction: vi.fn(),
  deletePlaceAction: vi.fn(),
  reorderDayAction: vi.fn(),
  promoteToDayAction: vi.fn(),
  moveToSavedAction: vi.fn(),
  recomputeDayLegsAction: vi.fn(),
}));

// usePlacesAutocomplete: { predictions, loading, search, select, clear }
const selectFn = vi.fn(async () => ({
  googlePlaceId: 'g1',
  name: 'Senso-ji',
  address: 'Asakusa, Tokyo',
  lat: 35.71,
  lng: 139.79,
  categoryGuess: 'sightseeing',
  photoRef: null,
  photoLocalPath: null,
  cached: false,
}));
const clearFn = vi.fn();
vi.mock('@/components/plan/useGooglePlaces', () => ({
  usePlacesAutocomplete: () => ({
    predictions: [{ placeId: 'g1', description: 'Senso-ji, Asakusa' }],
    loading: false,
    search: vi.fn(),
    select: selectFn,
    clear: clearFn,
  }),
}));

// forwardGeocode: typed-address → coords (or null on no match)
const forwardGeocode = vi.fn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (..._a: any[]): Promise<{ lat: number; lng: number; address: string | null } | null> => ({
    lat: 48.85,
    lng: 2.35,
    address: 'Paris, France',
  }),
);
vi.mock('@/components/plan/googleClient', () => ({
  reverseGeocode: vi.fn(async () => null),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  forwardGeocode: (...a: any[]) => forwardGeocode(...a),
}));

import { AddPlaceSheet } from './AddPlaceSheet';

function renderSheet(props: Partial<React.ComponentProps<typeof AddPlaceSheet>> = {}) {
  const onClose = vi.fn();
  const onAdded = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AddPlaceSheet
        open
        tripId="t1"
        dayDate="2026-05-03"
        disabled={false}
        onClose={onClose}
        onAdded={onAdded}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onClose, onAdded };
}

beforeEach(() => {
  addPlaceAction.mockClear();
  generatePlaceSummaryAction.mockClear();
  selectFn.mockClear();
  clearFn.mockClear();
  forwardGeocode.mockReset().mockResolvedValue({ lat: 48.85, lng: 2.35, address: 'Paris, France' });
});

describe('AddPlaceSheet', () => {
  it('adds a place from a Google suggestion (fills name + coords, no geocode)', async () => {
    const { onAdded, onClose } = renderSheet();
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(addPlaceAction).toHaveBeenCalled());
    expect(addPlaceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 't1',
        dayDate: '2026-05-03',
        name: 'Senso-ji',
        googlePlaceId: 'g1',
        category: 'sightseeing',
        lat: 35.71,
        lng: 139.79,
      }),
    );
    expect(forwardGeocode).not.toHaveBeenCalled();
    expect(onAdded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves to the Saved bucket when dayDate is null', async () => {
    renderSheet({ dayDate: null });
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() =>
      expect(addPlaceAction).toHaveBeenCalledWith(expect.objectContaining({ dayDate: null })),
    );
  });

  it('adds a hand-typed place, forward-geocoding the address to coordinates', async () => {
    renderSheet();
    await userEvent.type(screen.getByLabelText(en.plan.nameLabel), 'Hidden Café');
    await userEvent.type(screen.getByLabelText(en.plan.addressLabel), '12 Rue de Rivoli, Paris');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(forwardGeocode).toHaveBeenCalledWith('12 Rue de Rivoli, Paris'));
    expect(addPlaceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 't1',
        name: 'Hidden Café',
        address: '12 Rue de Rivoli, Paris',
        googlePlaceId: null,
        lat: 48.85,
        lng: 2.35,
      }),
    );
  });

  it('still saves a hand-typed place when geocoding finds nothing (null coords)', async () => {
    forwardGeocode.mockResolvedValueOnce(null);
    renderSheet();
    await userEvent.type(screen.getByLabelText(en.plan.nameLabel), 'Grandma’s house');
    await userEvent.type(screen.getByLabelText(en.plan.addressLabel), 'somewhere only we know');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(addPlaceAction).toHaveBeenCalled());
    expect(addPlaceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Grandma’s house',
        address: 'somewhere only we know',
        lat: null,
        lng: null,
        googlePlaceId: null,
      }),
    );
  });

  it('saves a name-only place with no address and no geocoding', async () => {
    renderSheet();
    await userEvent.type(screen.getByLabelText(en.plan.nameLabel), 'Picnic spot');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(addPlaceAction).toHaveBeenCalled());
    expect(forwardGeocode).not.toHaveBeenCalled();
    expect(addPlaceAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Picnic spot', address: null, lat: null, lng: null }),
    );
  });

  it('requires a name: shows an error and does not call the action', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.plan.nameRequired));
    expect(addPlaceAction).not.toHaveBeenCalled();
  });

  it('disables the name + address inputs when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByLabelText(en.plan.nameLabel)).toBeDisabled();
    expect(screen.getByLabelText(en.plan.addressLabel)).toBeDisabled();
  });

  it('shows an error and keeps the sheet open when the action rejects', async () => {
    addPlaceAction.mockRejectedValueOnce(new Error('server error'));
    const { onClose, onAdded } = renderSheet();
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.plan.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('closes the sheet when Escape is pressed on the dialog', async () => {
    const { onClose } = renderSheet();
    await userEvent.type(screen.getByRole('dialog'), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('fires AI summary generation after a successful add', async () => {
    renderSheet(); // existing helper
    await userEvent.type(screen.getByLabelText(en.plan.nameLabel), 'Senso-ji');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(addPlaceAction).toHaveBeenCalled());
    await waitFor(() => expect(generatePlaceSummaryAction).toHaveBeenCalledWith('new-place'));
  });
});
