import { redirect, notFound } from 'next/navigation';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { tripStatus } from '@/src/lib/days';
import { env } from '@/src/env';

export const dynamic = 'force-dynamic';

export default async function TripIndexPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = getTrip(db, tripId); // getTrip is synchronous
  if (!trip) notFound();

  // Active → today (container TZ); else explicit Day 1 (start_date). §3.8 / §8.1.
  const status = tripStatus(trip, env.TZ);
  const date =
    status === 'active'
      ? new Intl.DateTimeFormat('en-CA', { timeZone: env.TZ }).format(new Date())
      : trip.startDate;

  redirect(
    `/trip/${tripId}/plan?view=list&bucket=days&date=${date}`,
  );
}
