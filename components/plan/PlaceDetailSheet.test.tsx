import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updatePlaceAction = vi.fn(async (..._a: any[]) => ({ id: 'p1' }));
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatePlaceAction: (...a: any[]) => updatePlaceAction(...a),
  deletePlaceAction: vi.fn(),
  reorderDayAction: vi.fn(),
  promoteToDayAction: vi.fn(),
  moveToSavedAction: vi.fn(),
  recomputeDayLegsAction: vi.fn(),
}));

// Add alongside the existing places action mock:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deletePhotoAction = vi.fn(async (..._args: any[]) => undefined);
vi.mock('@/app/_actions/photos', () => {
  return {
    deletePhotoAction: (id: string) => deletePhotoAction(id),
  };
});

const uploadFn = vi.fn(async () => ({ photo: { id: 'new-photo', width: 1600, height: 800 }, errorCode: null }));
const uploadState = { uploading: false, error: null as string | null };
vi.mock('@/components/plan/usePhotoUpload', () => ({
  usePhotoUpload: () => ({ upload: uploadFn, uploading: uploadState.uploading, error: uploadState.error }),
}));

import { PlaceDetailSheet } from './PlaceDetailSheet';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g1',
    name: 'Senso-ji', address: 'Asakusa', lat: 35.71, lng: 139.79,
    category: 'sightseeing', scheduledTime: '09:30', durationMin: 90, cost: 1500,
    notes: 'Bring cash', orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], ...over,
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
        currency="JPY"
        locale="en"
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
});

describe('PlaceDetailSheet', () => {
  it('renders an Open in Google Maps link with a query_place_id deep link', () => {
    renderSheet();
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query_place_id=g1'));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('falls back to coordinates for map-drop pins (no googlePlaceId)', () => {
    renderSheet({ place: place({ googlePlaceId: null }) });
    const link = screen.getByRole('link', { name: en.plan.openInGoogleMaps });
    expect(link).toHaveAttribute('href', expect.stringContaining('query=35.71%2C139.79'));
  });

  it('saves edited fields via updatePlaceAction', async () => {
    const { onSaved } = renderSheet();
    const name = screen.getByLabelText(en.plan.nameLabel);
    await userEvent.clear(name);
    await userEvent.type(name, 'Senso-ji Temple');
    await userEvent.click(screen.getByRole('button', { name: en.plan.save }));
    await waitFor(() => expect(updatePlaceAction).toHaveBeenCalled());
    expect(updatePlaceAction).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'Senso-ji Temple' }));
    expect(onSaved).toHaveBeenCalled();
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
});
