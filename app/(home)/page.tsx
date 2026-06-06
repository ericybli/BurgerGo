import { db } from '@/src/db/client';
import { getTrips } from '@/src/db/repos/trips';
import { env } from '@/src/env';
import { HomeClient } from '@/components/HomeClient';

// Home reads live DB state; never statically cached.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // getTrips is synchronous; pass the { tz } ctx for Active-first sort.
  const trips = getTrips(db, { tz: env.TZ }); // repo returns Active-first then date order
  return <HomeClient trips={trips} tz={env.TZ} />;
}
