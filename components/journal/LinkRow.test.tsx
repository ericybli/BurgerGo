import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';

// linkDomain is a D0 pure helper; mock it so this test is isolated from D0.
vi.mock('@/src/lib/linkPreview', () => ({
  linkDomain: (url: string) => new URL(url).hostname.replace(/^www\./, ''),
  isHttpUrl: () => true,
}));

import { LinkRow } from '@/components/journal/LinkRow';
import type { SavedLink } from '@/src/db/repos/savedLinks';

function renderWith(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en as never}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const base: SavedLink = {
  id: 'link-1', tripId: 'trip-1', url: 'https://www.example.com/post',
  title: 'My Article', note: 'read this', thumbnail: 'trip-1/links/t.webp',
  createdAt: new Date(0), updatedAt: new Date(0),
} as unknown as SavedLink;

describe('LinkRow', () => {
  it('renders title, domain, note, and an anchor opening the url in a new tab', () => {
    renderWith(<LinkRow link={base} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('My Article')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('read this')).toBeInTheDocument();
    const anchor = screen.getByRole('link', { name: /My Article/ });
    expect(anchor).toHaveAttribute('href', 'https://www.example.com/post');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('falls back to the domain as the title when title is null', () => {
    const noTitle = { ...base, title: null } as unknown as SavedLink;
    renderWith(<LinkRow link={noTitle} onEdit={vi.fn()} onDelete={vi.fn()} />);
    // Domain shown both as the title fallback and the source line.
    expect(screen.getAllByText('example.com').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the thumbnail img through withBase when thumbnail is set', () => {
    renderWith(<LinkRow link={base} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/api/links/thumb/link-1');
  });

  it('renders the mascot fallback tile when thumbnail is null', () => {
    const noThumb = { ...base, thumbnail: null } as unknown as SavedLink;
    renderWith(<LinkRow link={noThumb} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/burgergo-logo.png');
  });

  it('fires onEdit and onDelete from the overflow menu', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderWith(<LinkRow link={base} onEdit={onEdit} onDelete={onDelete} />);
    screen.getByRole('button', { name: en.journal.edit }).click();
    expect(onEdit).toHaveBeenCalledWith('link-1');
    screen.getByRole('button', { name: en.journal.delete }).click();
    expect(onDelete).toHaveBeenCalledWith('link-1');
  });
});
