import { env } from '@/src/env';
import { BudgetClient } from '@/components/budget/BudgetClient';

// Static app shell: no server DB read, no cookies() — so the SW caches the page
// document and it loads offline. BudgetClient client-fetches /api/trips/:id/budget
// (+ /places for the link dropdown), derives planned-vs-actual, and owns the
// add/edit/set-budget sheets. English-only locale matches i18n/request.ts.
export const dynamic = 'force-static';

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <BudgetClient tripId={tripId} currency={env.DEFAULT_CURRENCY} locale="en" />;
}
