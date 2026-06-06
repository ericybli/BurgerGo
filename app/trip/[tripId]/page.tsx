import { redirect } from 'next/navigation';

// The /trip/:id index unconditionally redirects to the Plan tab. No DB read and
// no `force-dynamic`; `force-static` keeps it offline-safe + statically cacheable
// for any id. The active-aware "today landing" belongs to the real Plan tab in a
// later plan; the 1A Plan tab is a placeholder that ignores date params anyway.
export const dynamic = 'force-static';
export default async function TripIndexPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  redirect(`/trip/${tripId}/plan`);
}
