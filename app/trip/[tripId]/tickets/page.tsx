import { TicketsClient } from '@/components/tickets/TicketsClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. TicketsClient client-fetches
// /api/trips/:id/tickets and owns all interaction state.
export const dynamic = 'force-static';

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TicketsClient tripId={tripId} />;
}
