import { env } from '@/src/env';
import { EatsClient } from '@/components/eats/EatsClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. EatsClient client-fetches /api/trips/:id and
// /api/trips/:id/restaurants and owns all interaction state. English-only locale
// matches i18n/request.ts. (spec §4.1 / §7.3)
export const dynamic = 'force-static';

export default async function EatsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <EatsClient tripId={tripId} tz={env.TZ} currency={env.DEFAULT_CURRENCY} locale="en" />;
}
