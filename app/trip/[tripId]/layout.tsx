import { notFound } from 'next/navigation';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { TripHeader } from '@/components/TripHeader';
import { BottomTabBar } from '@/components/BottomTabBar';

function formatSubtitle(startDate: string, endDate: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const start = fmt.format(new Date(`${startDate}T00:00:00Z`));
  const end = fmt.format(new Date(`${endDate}T00:00:00Z`));
  return `${start} – ${end}`;
}

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const trip = getTrip(db, tripId); // getTrip is synchronous
  if (!trip) notFound();

  return (
    <div className="min-h-screen pb-20">
      <TripHeader
        tripId={trip.id}
        name={trip.name}
        dateSubtitle={formatSubtitle(trip.startDate, trip.endDate)}
      />
      {children}
      <BottomTabBar tripId={trip.id} />
    </div>
  );
}
