import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const addEntryAction = vi.fn();
const updateEntryAction = vi.fn();
const deleteEntryAction = vi.fn();
vi.mock('@/app/_actions/journal', () => ({
  addEntryAction: (...a: unknown[]) => addEntryAction(...a),
  updateEntryAction: (...a: unknown[]) => updateEntryAction(...a),
  deleteEntryAction: (...a: unknown[]) => deleteEntryAction(...a),
}));
const deletePhotoAction = vi.fn();
vi.mock('@/app/_actions/photos', () => ({
  deletePhotoAction: (...a: unknown[]) => deletePhotoAction(...a),
}));
const upload = vi.fn();
vi.mock('@/components/plan/usePhotoUpload', () => ({
  usePhotoUpload: () => ({ upload, uploading: false, error: null }),
}));
vi.mock('@/components/plan/PhotoGallery', () => ({
  PhotoGallery: ({ photos }: { photos: Array<{ id: string }> }) => (
    <div data-testid="gallery">{photos.length}</div>
  ),
}));

import { EntrySheet } from '@/components/journal/EntrySheet';
import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const editEntry = {
  id: 'e1', tripId: 'trip-1', title: 'Day One', body: 'hello', entryDate: '2026-06-05',
  createdAt: 0, updatedAt: 0,
  photos: [{ id: 'ph1', width: 800, height: 600 }],
} as unknown as EntryDTO;

describe('EntrySheet', () => {
  beforeEach(() => {
    addEntryAction.mockReset().mockResolvedValue({ id: 'e-new' });
    updateEntryAction.mockReset().mockResolvedValue({ id: 'e1' });
    deleteEntryAction.mockReset().mockResolvedValue(undefined);
    deletePhotoAction.mockReset().mockResolvedValue(undefined);
    upload.mockReset().mockResolvedValue({ photo: { id: 'ph2' }, errorCode: null });
  });

  it('renders nothing when closed', () => {
    const { container } = renderWith(
      <EntrySheet open={false} tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('defaults the date to today in add mode and hides the photo control', () => {
    renderWith(
      <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.journal.dateLabel) as HTMLInputElement).value).toBe('2026-06-06');
    // photos require an entry id → add mode shows the hint, not a file input
    expect(screen.getByText(en.journal.photosAfterSaveHint)).toBeInTheDocument();
    expect(screen.queryByLabelText(en.journal.addPhoto)).toBeNull();
  });

  it('rejects a blank title with the validation message (no action call)', async () => {
    renderWith(
      <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.journal.titleRequired));
    expect(addEntryAction).not.toHaveBeenCalled();
  });

  it('adds an entry with title/body/entryDate', async () => {
    const onSaved = vi.fn();
    renderWith(
      <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
    );
    fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'My Day' } });
    fireEvent.change(screen.getByLabelText(en.journal.bodyLabel), { target: { value: 'It rained.' } });
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(addEntryAction).toHaveBeenCalledTimes(1));
    expect(addEntryAction).toHaveBeenCalledWith({
      tripId: 'trip-1', title: 'My Day', body: 'It rained.', entryDate: '2026-06-06',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('sends null entryDate when the date is cleared', async () => {
    renderWith(
      <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(en.journal.dateLabel), { target: { value: '' } });
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(addEntryAction).toHaveBeenCalledWith(
      expect.objectContaining({ entryDate: null }),
    ));
  });

  it('inserts bold markdown around the selection via the toolbar', () => {
    renderWith(
      <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    const ta = screen.getByLabelText(en.journal.bodyLabel) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'word' } });
    ta.setSelectionRange(0, 4);
    screen.getByRole('button', { name: en.journal.mdBold }).click();
    expect(ta.value).toBe('**word**');
  });

  it('pre-fills, updates, and shows the photo gallery + Delete in edit mode', async () => {
    renderWith(
      <EntrySheet open tripId="trip-1" entry={editEntry} today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('Day One');
    expect(screen.getByTestId('gallery')).toHaveTextContent('1');
    fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'Edited' } });
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(updateEntryAction).toHaveBeenCalledWith('e1', expect.objectContaining({ title: 'Edited' })));
    expect(screen.getByRole('button', { name: en.journal.delete })).toBeInTheDocument();
  });

  it('deletes only after the inline confirm in edit mode', async () => {
    const onSaved = vi.fn();
    renderWith(
      <EntrySheet open tripId="trip-1" entry={editEntry} today="2026-06-06" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
    );
    screen.getByRole('button', { name: en.journal.delete }).click();
    expect(deleteEntryAction).not.toHaveBeenCalled();
    screen.getByRole('button', { name: en.journal.confirmDelete }).click();
    await waitFor(() => expect(deleteEntryAction).toHaveBeenCalledWith('e1'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows an inline error and keeps the sheet open when save rejects', async () => {
    addEntryAction.mockRejectedValueOnce(new Error('boom'));
    const onClose = vi.fn();
    renderWith(
      <EntrySheet open tripId="trip-1" today="2026-06-06" disabled={false} onClose={onClose} onSaved={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'X' } });
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.journal.saveFailed));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables Save and shows the offline notice when offline', () => {
    renderWith(
      <EntrySheet open tripId="trip-1" today="2026-06-06" disabled onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: en.journal.save })).toBeDisabled();
    expect(screen.getByText(en.journal.offlineHint)).toBeInTheDocument();
  });
});
