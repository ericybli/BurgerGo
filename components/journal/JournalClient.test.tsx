import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/components/journal/EntrySheet', () => ({
  EntrySheet: ({ open }: { open: boolean }) => (open ? <div data-testid="entry-sheet" /> : null),
}));
vi.mock('@/components/journal/EntryReader', () => ({
  EntryReader: ({ entry }: { entry: { title: string } }) => <div data-testid="entry-reader">{entry.title}</div>,
}));
vi.mock('@/src/lib/journalView', () => ({
  entrySnippet: (body: string) => `snippet:${body}`,
}));

import { JournalClient } from '@/components/journal/JournalClient';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const journalBody = {
  entries: [
    { id: 'e1', tripId: 'trip-1', title: 'Day Two', body: 'rain', entryDate: '2026-06-06', createdAt: 2, updatedAt: 2, photos: [{ id: 'ph1', width: 800, height: 600 }] },
    { id: 'e2', tripId: 'trip-1', title: 'Day One', body: 'sun', entryDate: '2026-06-05', createdAt: 1, updatedAt: 1, photos: [] },
  ],
  links: [],
};

function mockFetchOk(body: unknown = journalBody) {
  return vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response));
}

describe('JournalClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetchOk());
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('shows a loading state then renders the entries feed', async () => {
    renderWith(<JournalClient tripId="trip-1" />);
    expect(screen.getByText(en.journal.loading)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
    expect(screen.getByText('Day One')).toBeInTheDocument();
    expect(screen.getByText('snippet:rain')).toBeInTheDocument();
  });

  it('fetches the journal read handler with the base-prefixed URL', async () => {
    renderWith(<JournalClient tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.endsWith('/api/trips/trip-1/journal'))).toBe(true);
  });

  it('toggles to the reading-list sub-view and back', async () => {
    renderWith(<JournalClient tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: en.journal.readingList }));
    expect(screen.getByRole('button', { name: en.journal.readingList })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(en.journal.linksEmptyHeadline)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: en.journal.entries }));
    expect(screen.getByText('Day Two')).toBeInTheDocument();
  });

  it('opens the editor in add mode from the new-entry button', async () => {
    renderWith(<JournalClient tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: en.journal.newEntry }));
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument();
  });

  it('opens the reader when an entry card is tapped', async () => {
    renderWith(<JournalClient tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Day Two/ }));
    expect(screen.getByTestId('entry-reader')).toHaveTextContent('Day Two');
  });

  it('disables the new-entry button when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    renderWith(<JournalClient tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText('Day Two')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: en.journal.newEntry })).toBeDisabled();
  });

  it('renders the error state when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)));
    renderWith(<JournalClient tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText(en.journal.errorHeadline)).toBeInTheDocument());
  });

  it('shows the empty state when there are no entries', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ entries: [], links: [] }));
    renderWith(<JournalClient tripId="trip-1" />);
    await waitFor(() => expect(screen.getByText(en.journal.emptyHeadline)).toBeInTheDocument());
  });
});

// --- D2: reading-list sub-view -------------------------------------------
// (added to components/journal/JournalClient.test.tsx)
describe('JournalClient — reading list', () => {
  const links = [
    {
      id: 'link-1', tripId: 'trip-1', url: 'https://example.com/a', title: 'Article A',
      note: null, thumbnail: null, createdAt: 0, updatedAt: 0,
    },
  ];

  function mockJournalFetch(payload: { entries?: unknown[]; links?: unknown[] }) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ entries: payload.entries ?? [], links: payload.links ?? [] }),
      })),
    );
  }

  beforeEach(() => {
    // Online by default for the gating assertions.
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('renders saved links as rows under the reading-list tab', async () => {
    mockJournalFetch({ links });
    renderWith(<JournalClient tripId="trip-1" />);
    // Switch to the reading-list sub-view.
    (await screen.findByRole('button', { name: en.journal.readingListTab })).click();
    expect(await screen.findByText('Article A')).toBeInTheDocument();
  });

  it('shows the links empty state when there are no links', async () => {
    mockJournalFetch({ links: [] });
    renderWith(<JournalClient tripId="trip-1" />);
    (await screen.findByRole('button', { name: en.journal.readingListTab })).click();
    expect(await screen.findByText(en.journal.linksEmptyHeadline)).toBeInTheDocument();
  });

  it('opens the LinkSheet from the Add link button (online)', async () => {
    mockJournalFetch({ links: [] });
    renderWith(<JournalClient tripId="trip-1" />);
    (await screen.findByRole('button', { name: en.journal.readingListTab })).click();
    (await screen.findByRole('button', { name: en.journal.addLink })).click();
    expect(await screen.findByRole('dialog', { name: en.journal.addLink })).toBeInTheDocument();
  });
});
