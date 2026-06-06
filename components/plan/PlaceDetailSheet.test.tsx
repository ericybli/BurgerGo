import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { PlaceDTO } from '@/src/lib/planView';

const updatePlaceAction = vi.fn(async () => ({ id: 'p1' }));
vi.mock('@/app/_actions/places', () => ({
  addPlaceAction: vi.fn(),
  updatePlaceAction: (...a: unknown[]) => updatePlaceAction(...a),
  deletePlaceAction: vi.fn(),
  reorderDayAction: vi.fn(),
  promoteToDayAction: vi.fn(),
  moveToSavedAction: vi.fn(),
  recomputeDayLegsAction: vi.fn(),
}));

import { PlaceDetailSheet } from './PlaceDetailSheet';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: 'g1',
    name: 'Senso-ji', address: 'Asakusa', lat: 35.71, lng: 139.79,
    category: 'sightseeing', scheduledTime: '09:30', durationMin: 90, cost: 1500,
    notes: 'Bring cash', orderIndex: 0, photoPath: null, ...over,
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

beforeEach(() => updatePlaceAction.mockClear());

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
});
