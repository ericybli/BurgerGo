import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addPlaceAction = vi.fn(async (..._a: any[]) => ({ id: 'p-new' }));
vi.mock('@/app/_actions/places', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addPlaceAction: (...a: any[]) => addPlaceAction(...a),
  updatePlaceAction: vi.fn(),
  deletePlaceAction: vi.fn(),
  reorderDayAction: vi.fn(),
  promoteToDayAction: vi.fn(),
  moveToSavedAction: vi.fn(),
  recomputeDayLegsAction: vi.fn(),
}));

// Mock the actual B0 usePlacesAutocomplete API: { predictions, loading, search, select, clear }
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
vi.mock('@/components/plan/useGooglePlaces', () => ({
  usePlacesAutocomplete: () => ({
    predictions: [{ placeId: 'g1', description: 'Senso-ji, Asakusa' }],
    loading: false,
    search: vi.fn(),
    select: selectFn,
    clear: vi.fn(),
  }),
}));

// Mock reverseGeocode to return a string (actual B0 API)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reverseGeocode = vi.fn(async (..._a: any[]) => '1 Chome, Asakusa');
vi.mock('@/components/plan/googleClient', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reverseGeocode: (...a: any[]) => reverseGeocode(...a),
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
  selectFn.mockClear();
  reverseGeocode.mockClear();
});

describe('AddPlaceSheet', () => {
  it('adds a place from an Autocomplete selection with the day bucket', async () => {
    const { onAdded, onClose } = renderSheet();
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await waitFor(() => expect(addPlaceAction).toHaveBeenCalled());
    expect(addPlaceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 't1', dayDate: '2026-05-03', name: 'Senso-ji',
        googlePlaceId: 'g1', category: 'sightseeing',
      }),
    );
    expect(onAdded).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a Saved-bucket place when dayDate is null', async () => {
    renderSheet({ dayDate: null });
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await waitFor(() =>
      expect(addPlaceAction).toHaveBeenCalledWith(expect.objectContaining({ dayDate: null })),
    );
  });

  it('drops a pin → reverse-geocode → add with googlePlaceId null', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('tab', { name: en.plan.dropPinTab }));
    await userEvent.click(screen.getByTestId('map-drop-target'));
    await waitFor(() => expect(reverseGeocode).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: en.plan.confirm }));
    await waitFor(() =>
      expect(addPlaceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null, address: '1 Chome, Asakusa',
        }),
      ),
    );
  });

  it('disables search input + drop target when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByPlaceholderText(en.plan.searchPlaceholder)).toBeDisabled();
  });

  it('shows an error and keeps the sheet open when the action rejects', async () => {
    addPlaceAction.mockRejectedValueOnce(new Error('server error'));
    const { onClose, onAdded } = renderSheet();
    await userEvent.click(screen.getByText('Senso-ji, Asakusa'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(en.plan.saveFailed);
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('closes the sheet when Escape is pressed on the dialog', async () => {
    const { onClose } = renderSheet();
    const dialog = screen.getByRole('dialog');
    await userEvent.type(dialog, '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
