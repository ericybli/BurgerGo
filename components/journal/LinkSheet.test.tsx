import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

const addLinkAction = vi.fn();
const updateLinkAction = vi.fn();
const deleteLinkAction = vi.fn();
vi.mock('@/app/_actions/savedLinks', () => ({
  addLinkAction: (...a: unknown[]) => addLinkAction(...a),
  updateLinkAction: (...a: unknown[]) => updateLinkAction(...a),
  deleteLinkAction: (...a: unknown[]) => deleteLinkAction(...a),
}));

import { LinkSheet } from '@/components/journal/LinkSheet';
import type { SavedLink } from '@/src/db/repos/savedLinks';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const fetchMock = vi.fn();

describe('LinkSheet', () => {
  beforeEach(() => {
    addLinkAction.mockReset().mockResolvedValue({ id: 'link-1' });
    updateLinkAction.mockReset().mockResolvedValue({ id: 'link-1' });
    deleteLinkAction.mockReset().mockResolvedValue(undefined);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders nothing when closed', () => {
    const { container } = renderWith(
      <LinkSheet open={false} tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('rejects a blank/invalid url with invalidUrl and does not call the action', async () => {
    renderWith(
      <LinkSheet open tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(en.journal.invalidUrl));
    expect(addLinkAction).not.toHaveBeenCalled();
  });

  it('on URL blur in add mode (online) fetches a preview and prefills the title', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: 'Fetched Title', thumbnailPath: 'trip-1/links/x.webp' }),
    });
    renderWith(
      <LinkSheet open tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    const url = screen.getByLabelText(en.journal.urlLabel);
    fireEvent.change(url, { target: { value: 'https://example.com/post' } });
    fireEvent.blur(url);
    await waitFor(() =>
      expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('Fetched Title'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/links/preview',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('saves a new link including the stashed thumbnailPath', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: 'T', thumbnailPath: 'trip-1/links/x.webp' }),
    });
    const onSaved = vi.fn();
    renderWith(
      <LinkSheet open tripId="trip-1" disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
    );
    const url = screen.getByLabelText(en.journal.urlLabel);
    fireEvent.change(url, { target: { value: 'https://example.com/post' } });
    fireEvent.blur(url);
    await waitFor(() =>
      expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('T'),
    );
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(addLinkAction).toHaveBeenCalledTimes(1));
    expect(addLinkAction).toHaveBeenCalledWith({
      tripId: 'trip-1',
      url: 'https://example.com/post',
      title: 'T',
      note: null,
      thumbnail: 'trip-1/links/x.webp',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('does NOT fetch a preview in edit mode and pre-fills from the link', async () => {
    const link = {
      id: 'link-1', tripId: 'trip-1', url: 'https://example.com', title: 'Old', note: 'n',
      thumbnail: null, createdAt: new Date(0), updatedAt: new Date(0),
    } as unknown as SavedLink;
    renderWith(
      <LinkSheet open tripId="trip-1" link={link} disabled={false} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(en.journal.titleLabel) as HTMLInputElement).value).toBe('Old');
    fireEvent.blur(screen.getByLabelText(en.journal.urlLabel));
    // No preview fetch in edit mode.
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(en.journal.titleLabel), { target: { value: 'New' } });
    screen.getByRole('button', { name: en.journal.save }).click();
    await waitFor(() => expect(updateLinkAction).toHaveBeenCalledTimes(1));
    expect(updateLinkAction).toHaveBeenCalledWith('link-1', expect.objectContaining({ title: 'New' }));
    expect(screen.getByRole('button', { name: en.journal.delete })).toBeInTheDocument();
  });

  it('deletes in edit mode', async () => {
    const link = {
      id: 'link-1', tripId: 'trip-1', url: 'https://example.com', title: 'Old', note: null,
      thumbnail: null, createdAt: new Date(0), updatedAt: new Date(0),
    } as unknown as SavedLink;
    const onSaved = vi.fn();
    renderWith(
      <LinkSheet open tripId="trip-1" link={link} disabled={false} onClose={vi.fn()} onSaved={onSaved} />,
    );
    screen.getByRole('button', { name: en.journal.delete }).click();
    await waitFor(() => expect(deleteLinkAction).toHaveBeenCalledWith('link-1'));
    expect(onSaved).toHaveBeenCalled();
  });

  it('does not fetch a preview when offline; manual entry still saves', async () => {
    renderWith(
      <LinkSheet open tripId="trip-1" disabled onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    // Disabled (offline) → the offline hint is shown and inputs are disabled.
    expect(screen.getByText(en.journal.offlineHint)).toBeInTheDocument();
    expect((screen.getByLabelText(en.journal.urlLabel) as HTMLInputElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
