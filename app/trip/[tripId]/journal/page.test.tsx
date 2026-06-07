import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub JournalClient so the page test asserts wiring (props), not the client.
const journalClientProps = vi.fn();
vi.mock('@/components/journal/JournalClient', () => ({
  JournalClient: (props: Record<string, unknown>) => {
    journalClientProps(props);
    return <div data-testid="journal-client" />;
  },
}));

import JournalPage, { dynamic } from '@/app/trip/[tripId]/journal/page';

describe('JournalPage (static shell)', () => {
  it('is force-static so the SW caches the shell for offline', () => {
    expect(dynamic).toBe('force-static');
  });

  it('renders JournalClient with the trip id', async () => {
    const ui = await JournalPage({ params: Promise.resolve({ tripId: 'trip-1' }) });
    render(ui);
    expect(screen.getByTestId('journal-client')).toBeInTheDocument();
    expect(journalClientProps).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 'trip-1' }),
    );
  });
});
