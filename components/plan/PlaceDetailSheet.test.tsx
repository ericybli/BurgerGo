import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updatePlaceAction = vi.fn(async (..._a: any[]) => ({ id: 'p1' }));
const generatePlaceSummaryAction = vi.fn(async (_id: string) => ({ id: 'p1', aiSummary: 'Fresh blurb.' }));
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatePlaceAction: (...a: any[]) => updatePlaceAction(...a),
  deletePlaceAction: vi.fn(),
  reorderDayAction: vi.fn(),
  promoteToDayAction: vi.fn(),
  moveToSavedAction: vi.fn(),
  recomputeDayLegsAction: vi.fn(),
  generatePlaceSummaryAction: (id: string) => generatePlaceSummaryAction(id),
}));

// Add alongside the existing places action mock:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deletePhotoAction = vi.fn(async (..._args: any[]) => undefined);
vi.mock('@/app/_actions/photos', () => {
  return {
    deletePhotoAction: (id: string) => deletePhotoAction(id),
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addExpenseAction = vi.fn(async (..._a: any[]) => ({ id: 'e1' }));
vi.mock('@/app/_actions/expenses', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addExpenseAction: (...a: any[]) => addExpenseAction(...a),
}));

const uploadFn = vi.fn(async () => ({ photo: { id: 'new-photo', width: 1600, height: 800 }, errorCode: null }));
const uploadState = { uploading: false, error: null as string | null };
vi.mock('@/components/plan/usePhotoUpload', () => ({
  usePhotoUpload: () => ({ upload: uploadFn, uploading: uploadState.uploading, error: uploadState.error }),
}));

// Controllable Places autocomplete for the re-pin flow.
const autocompleteState = { predictions: [] as Array<{ placeId: string; description: string }> };
const selectFn = vi.fn(async (_id: string) => ({
  googlePlaceId: 'g2', name: 'Holei Sea Arch', address: 'Chain of Craters Rd, HI 96718',
  lat: 19.2986, lng: -155.1026, categoryGuess: 'sightseeing',
}));
vi.mock('@/components/plan/useGooglePlaces', () => ({
  usePlacesAutocomplete: () => ({
    predictions: autocompleteState.predictions,
    search: vi.fn(),
    select: (id: string) => selectFn(id),
    clear: vi.fn(),
  }),
}));

import { PlaceDetailSheet } from './PlaceDetailSheet';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g1',
    name: 'Senso-ji', address: 'Asakusa', lat: 35.71, lng: 139.79,
    category: 'sightseeing', scheduledTime: '09:30', durationMin: 90, cost: 1500,
    notes: 'Bring cash', orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null, listId: null, ...over,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof PlaceDetailSheet>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PlaceDetailSheet
        open
        place={place()}
        currency="USD"
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
  updatePlaceAction.mockClear();
  deletePhotoAction.mockClear();
  uploadFn.mockClear();
  generatePlaceSummaryAction.mockClear();
  selectFn.mockClear();
  addExpenseAction.mockClear();
  autocompleteState.predictions = [];
});

describe('PlaceDetailSheet', () => {
  it('re-pins the place (sends new coords + place id) when an address suggestion is picked', async () => {
    autocompleteState.predictions = [{ placeId: 'g2', description: 'Holei Sea Arch, Hawaii, USA' }];
    const { onSaved } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: /Holei Sea Arch/ }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(updatePlaceAction).toHaveBeenCalled());
    const patch = updatePlaceAction.mock.calls[0]![1];
    expect(patch).toMatchObject({ lat: 19.2986, lng: -155.1026, googlePlaceId: 'g2' });
    expect(onSaved).toHaveBeenCalledWith('p1', expect.objectContaining({ googlePlaceId: 'g2' }));
  });

  it('leaves coords untouched when the address is edited without picking a suggestion', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    const patch = updatePlaceAction.mock.calls[0]![1];
    expect(patch).not.toHaveProperty('lat');
    expect(patch).not.toHaveProperty('googlePlaceId');
  });

  it('renders an Open in Google Maps link with a query_place_id deep link', () => {
    renderSheet();
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query_place_id=g1'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('searches by name + address when there is no googlePlaceId (richer than a coordinate pin)', () => {
    renderSheet({ place: place({ googlePlaceId: null }) });
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query=Senso-ji%2C+Asakusa'));
    expect(link).toHaveAttribute('href', expect.not.stringContaining('query_place_id'));
  });

  it('saves edited fields via updatePlaceAction', async () => {
    const { onSaved } = renderSheet();
    const name = screen.getByLabelText(en.plan.nameLabel);
    await userEvent.clear(name);
    await userEvent.type(name, 'Senso-ji Temple');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(updatePlaceAction).toHaveBeenCalled());
    expect(updatePlaceAction).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Senso-ji Temple' }));
    // onSaved gets the id + patch so the parent can optimistically update (reopen shows fresh data).
    expect(onSaved).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Senso-ji Temple' }));
  });

  it('saves an added note and reports it to onSaved for optimistic refresh', async () => {
    const { onSaved } = renderSheet({ place: place({ notes: null }) });
    const notesField = screen.getByLabelText(en.plan.notesLabel);
    await userEvent.type(notesField, 'Bring sunscreen');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(updatePlaceAction).toHaveBeenCalled());
    expect(updatePlaceAction).toHaveBeenCalledWith('p1', expect.objectContaining({ notes: 'Bring sunscreen' }));
    expect(onSaved).toHaveBeenCalledWith('p1', expect.objectContaining({ notes: 'Bring sunscreen' }));
  });

  it('clears the scheduled time via the Clear button (saves scheduledTime: null)', async () => {
    renderSheet(); // place() has scheduledTime '09:30' → Clear is shown
    await userEvent.click(screen.getByRole('button', { name: en.plan.clear }));
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(updatePlaceAction).toHaveBeenCalled());
    expect(updatePlaceAction).toHaveBeenCalledWith('p1', expect.objectContaining({ scheduledTime: null }));
  });

  it('renders the cost field reflecting the place cost (minor → major units)', () => {
    renderSheet(); // place() has cost 1500 → "15.00" in USD
    expect(screen.getByLabelText('Cost')).toHaveValue('15.00');
  });

  it('saves the edited cost as integer minor units', async () => {
    renderSheet();
    const costInput = screen.getByLabelText('Cost');
    await userEvent.clear(costInput);
    await userEvent.type(costInput, '42');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(updatePlaceAction).toHaveBeenCalled());
    expect(updatePlaceAction).toHaveBeenCalledWith('p1', expect.objectContaining({ cost: 4200 }));
  });

  it('adds the cost as a budget expense linked to the place (mapped category)', async () => {
    const { onSaved } = renderSheet(); // place() cost 1500, sightseeing, dayDate 2026-05-03
    await userEvent.click(screen.getByRole('button', { name: en.plan.addAsExpense }));
    await waitFor(() => expect(addExpenseAction).toHaveBeenCalled());
    expect(addExpenseAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 't1', amount: 1500, category: 'activities',
        linkedPlaceId: 'p1', note: 'Senso-ji', spentOn: '2026-05-03',
      }),
    );
    // Adding an expense is independent of saving the place fields.
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: en.plan.addedToBudget })).toBeInTheDocument();
  });

  it('disables editable fields + Save when offline but keeps Open in Maps enabled', () => {
    renderSheet({ disabled: true });
    expect(screen.getByLabelText(en.plan.nameLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: en.plan.save })).toBeDisabled();
    expect(screen.getByRole('link', { name: en.plan.openInGoogleMaps })).toBeInTheDocument();
  });

  it('shows an error and keeps the sheet open when the action rejects', async () => {
    updatePlaceAction.mockRejectedValueOnce(new Error('server error'));
    const { onClose, onSaved } = renderSheet();
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(en.plan.saveFailed);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('closes the sheet when Escape is pressed on the dialog', async () => {
    const { onClose } = renderSheet();
    const dialog = screen.getByRole('dialog');
    await userEvent.type(dialog, '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders existing photos in a gallery', () => {
    renderSheet({ place: place({ photos: [{ id: 'ph1', width: 800, height: 600 }] }) });
    expect(screen.getByRole('img')).toHaveAttribute('src', '/api/photos/p/ph1/thumb');
  });

  it('uploads a chosen image then refreshes via onSaved', async () => {
    const { onSaved } = renderSheet();
    const input = screen.getByLabelText(en.plan.addPhoto) as HTMLInputElement;
    const file = new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' });
    await userEvent.upload(input, file);
    await waitFor(() => expect(uploadFn).toHaveBeenCalled());
    expect(uploadFn).toHaveBeenCalledWith(expect.objectContaining({ tripId: 't1', ownerId: 'p1', file }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('deletes a photo via deletePhotoAction then refreshes via onSaved', async () => {
    const { onSaved } = renderSheet({ place: place({ photos: [{ id: 'ph1', width: 800, height: 600 }] }) });
    await userEvent.click(screen.getByRole('button', { name: en.plan.deletePhoto }));
    await waitFor(() => expect(deletePhotoAction).toHaveBeenCalledWith('ph1'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('disables the photo upload control when offline', () => {
    renderSheet({ disabled: true });
    expect(screen.getByLabelText(en.plan.addPhoto)).toBeDisabled();
  });

  it('regenerate fills the AI summary field', async () => {
    renderSheet(); // existing helper that renders with a place
    await userEvent.click(screen.getByRole('button', { name: en.plan.regenerateSummary }));
    await waitFor(() => expect(generatePlaceSummaryAction).toHaveBeenCalledWith('p1'));
    expect(screen.getByLabelText(en.plan.aiSummary)).toHaveValue('Fresh blurb.');
  });
});
