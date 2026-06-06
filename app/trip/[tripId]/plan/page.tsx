import { env } from '@/src/env';
import { PlanClient } from '@/components/plan/PlanClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. PlanClient client-fetches /api/trips/:id (+
// /places), derives the day strip, resolves the landing date, and owns the URL
// state (?view&bucket&date). English-only locale matches i18n/request.ts.
// (spec §7.3/§8.2)
export const dynamic = 'force-static';

export default async function PlanPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <PlanClient tripId={tripId} tz={env.TZ} currency={env.DEFAULT_CURRENCY} locale="en" />;
}
