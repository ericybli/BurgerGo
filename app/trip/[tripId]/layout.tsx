import { TripShellClient } from '@/components/TripShellClient';

// Static app shell: no server-side DB read so the SW can cache the page document.
// `force-static` makes this dynamic-param route emit cacheable headers (not
// no-store) for any trip id — the per-trip data is client-fetched anyway.
// TripShellClient owns that data (header + tabs) from `/api/trips/:id`
// (SWR-cached) on mount. (§7.3/§8.2)
export const dynamic = 'force-static';
export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripShellClient tripId={tripId}>{children}</TripShellClient>;
}
