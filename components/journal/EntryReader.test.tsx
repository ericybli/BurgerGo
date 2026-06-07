import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

vi.mock('@/components/journal/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => <div data-testid="md">{source}</div>,
}));
vi.mock('@/components/plan/PhotoGallery', () => ({
  PhotoGallery: ({ photos }: { photos: Array<{ id: string }> }) => (
    <div data-testid="gallery">{photos.length}</div>
  ),
}));

import { EntryReader } from '@/components/journal/EntryReader';
import type { EntryDTO } from '@/app/api/trips/[tripId]/journal/route';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const baseEntry = {
  id: 'e1', tripId: 'trip-1', title: 'Day One', body: '# hi', entryDate: '2026-06-05',
  createdAt: 0, updatedAt: 0,
  photos: [{ id: 'ph1', width: 800, height: 600 }],
} as unknown as EntryDTO;

describe('EntryReader', () => {
  it('renders the title, the markdown body, and the photo gallery', async () => {
    renderWith(<EntryReader entry={baseEntry} onEdit={vi.fn()} onClose={vi.fn()} online />);
    expect(screen.getByText('Day One')).toBeInTheDocument();
    // Markdown is now lazy-loaded via next/dynamic, so it resolves async.
    expect(await screen.findByTestId('md')).toHaveTextContent('# hi');
    expect(screen.getByTestId('gallery')).toHaveTextContent('1');
  });

  it('shows the entry date when present', () => {
    renderWith(<EntryReader entry={baseEntry} onEdit={vi.fn()} onClose={vi.fn()} online />);
    expect(screen.getByText(/2026-06-05/)).toBeInTheDocument();
  });

  it('disables the Edit control when offline', () => {
    renderWith(<EntryReader entry={baseEntry} onEdit={vi.fn()} onClose={vi.fn()} online={false} />);
    expect(screen.getByRole('button', { name: en.journal.edit })).toBeDisabled();
  });
});
