import { JournalClient } from '@/components/journal/JournalClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. JournalClient client-fetches
// /api/trips/:id/journal, owns the entries feed/reader/editor, and (in D2) the
// reading list. English-only locale matches i18n/request.ts.
export const dynamic = 'force-static';

export default async function JournalPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <JournalClient tripId={tripId} />;
}
