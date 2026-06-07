import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import type { ImportPreviewItem } from '@/app/_actions/aiImport';

const extractImportItemsAction = vi.fn();
const createImportItemsAction = vi.fn();
vi.mock('@/app/_actions/aiImport', () => ({
  extractImportItemsAction: (...a: unknown[]) => extractImportItemsAction(...a),
  createImportItemsAction: (...a: unknown[]) => createImportItemsAction(...a),
}));
vi.mock('@/src/lib/downscaleImage', () => ({ downscaleImageToDataUrl: vi.fn(async () => 'data:image/jpeg;base64,XXX') }));
const emitTripDataChanged = vi.fn();
vi.mock('@/src/lib/events', () => ({ emitTripDataChanged: () => emitTripDataChanged() }));

import { AiImportSheet } from '@/components/ai/AiImportSheet';

function item(over: Partial<ImportPreviewItem> = {}): ImportPreviewItem {
  return { type: 'place', name: 'X', address: null, area: '', lat: null, lng: null, googlePlaceId: null, cuisine: '', category: '', notes: '', resolved: true, ...over };
}

function renderSheet(props: Partial<React.ComponentProps<typeof AiImportSheet>> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AiImportSheet open tripId="t1" onClose={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  extractImportItemsAction.mockReset();
  createImportItemsAction.mockReset();
  emitTripDataChanged.mockReset();
});

describe('AiImportSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AiImportSheet open={false} tripId="t1" onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Extract until there is text or an image', async () => {
    renderSheet();
    expect(screen.getByRole('button', { name: en.aiImport.extract })).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(en.aiImport.textPlaceholder), 'sushi place');
    expect(screen.getByRole('button', { name: en.aiImport.extract })).toBeEnabled();
  });

  it('extracts → preview → create, then summarizes and signals a refresh', async () => {
    extractImportItemsAction.mockResolvedValue({ items: [
      item({ type: 'restaurant', name: 'Ichiran', address: 'Tokyo', resolved: true }),
      item({ type: 'place', name: 'Senso-ji', address: null, resolved: false }),
    ] });
    createImportItemsAction.mockResolvedValue({ restaurants: 1, places: 1 });

    renderSheet();
    await userEvent.type(screen.getByPlaceholderText(en.aiImport.textPlaceholder), 'two spots');
    await userEvent.click(screen.getByRole('button', { name: en.aiImport.extract }));

    // Preview shows both, with the unmatched hint on the unresolved one.
    expect(await screen.findByDisplayValue('Ichiran')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Senso-ji')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(en.aiImport.unmatched))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Create 2/ }));
    await waitFor(() => expect(createImportItemsAction).toHaveBeenCalled());
    const arg = createImportItemsAction.mock.calls[0]![0] as { tripId: string; items: unknown[] };
    expect(arg.tripId).toBe('t1');
    expect(arg.items).toHaveLength(2);

    expect(await screen.findByText(/Added 1 to Eats and 1 to Saved/)).toBeInTheDocument();
    expect(emitTripDataChanged).toHaveBeenCalled();
  });

  it('lets you remove a row and toggle its type before creating', async () => {
    extractImportItemsAction.mockResolvedValue({ items: [
      item({ type: 'place', name: 'Keeper' }),
      item({ type: 'place', name: 'Dropme' }),
    ] });
    createImportItemsAction.mockResolvedValue({ restaurants: 1, places: 0 });

    renderSheet();
    await userEvent.type(screen.getByPlaceholderText(en.aiImport.textPlaceholder), 'x');
    await userEvent.click(screen.getByRole('button', { name: en.aiImport.extract }));
    await screen.findByDisplayValue('Keeper');

    // Remove the second row.
    const removeButtons = screen.getAllByRole('button', { name: en.aiImport.removeItem });
    await userEvent.click(removeButtons[1]!);
    expect(screen.queryByDisplayValue('Dropme')).not.toBeInTheDocument();

    // Flip the remaining row to a restaurant.
    await userEvent.click(screen.getByRole('button', { name: en.aiImport.typeRestaurant }));
    await userEvent.click(screen.getByRole('button', { name: /Create 1/ }));
    await waitFor(() => expect(createImportItemsAction).toHaveBeenCalled());
    const items = (createImportItemsAction.mock.calls[0]![0] as { items: Array<{ type: string; name: string }> }).items;
    expect(items).toEqual([expect.objectContaining({ type: 'restaurant', name: 'Keeper' })]);
  });

  it('shows an error and stays on input when nothing is found', async () => {
    extractImportItemsAction.mockResolvedValue({ items: [] });
    renderSheet();
    await userEvent.type(screen.getByPlaceholderText(en.aiImport.textPlaceholder), 'nope');
    await userEvent.click(screen.getByRole('button', { name: en.aiImport.extract }));
    expect(await screen.findByText(en.aiImport.nothingFound)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.aiImport.extract })).toBeInTheDocument();
  });
});
