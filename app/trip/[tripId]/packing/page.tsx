import { PackingClient } from '@/components/packing/PackingClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. PackingClient client-fetches
// /api/trips/:id/packing and owns all interaction state. (spec §7.3)
export const dynamic = 'force-static';

export default async function PackingPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <PackingClient tripId={tripId} />;
}
